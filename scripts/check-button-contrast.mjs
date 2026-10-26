import assert from "node:assert/strict";
import { build } from "esbuild";
import puppeteer from "puppeteer";

const url = process.env.ACCESSIBILITY_BASE_URL ?? "http://127.0.0.1:3000";
const sharedSelector = "button.transit-button";
const failures = [];
const counts = {};
const browser = await puppeteer.launch({
  args: ["--no-sandbox", "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4"],
});
const pause = () => new Promise((resolve) => setTimeout(resolve, 250));

async function theme(page, value) {
  await page.evaluate((value) => {
    if (value === "default") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
  }, value);
}

async function assertColorScope(page) {
  const leaks = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const probes = [
      ["input", "checkbox checkbox-primary"],
      ["span", "badge badge-primary"],
      ["progress", "progress progress-secondary"],
      ["button", "btn btn-primary gap-0 leading-relaxed font-medium"],
      ["button", "btn btn-primary ruby-text gap-0 leading-relaxed font-medium"],
    ];
    return probes.flatMap(([tag, className]) => {
      const probe = document.createElement(tag);
      probe.className = className;
      if (tag === "input") probe.type = "checkbox";
      document.body.append(probe);
      const style = getComputedStyle(probe);
      const changed = ["--color-primary", "--color-primary-content", "--color-secondary", "--color-secondary-content"]
        .filter((token) => style.getPropertyValue(token).trim() !== root.getPropertyValue(token).trim());
      probe.remove();
      return changed.map((token) => `${className}: ${token}`);
    });
  });
  assert.deepEqual(leaks, [], "unmarked controls must retain the theme's brand tokens");
}

async function measure(page, button, label) {
  const disabled = await button.evaluate((element) => element.disabled);
  for (const state of ["normal", "hover", "active", "focus"]) {
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.activeElement?.blur());
    await button.scrollIntoView();
    if (state === "hover" || state === "active") await button.hover();
    if (state === "active") await page.mouse.down();
    if (state === "focus") {
      // Chromium's keyboard modality, rather than programmatic focus alone.
      await page.keyboard.press("Tab");
      await button.focus();
    }
    await pause();
    const result = await button.evaluate((element) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const rgba = (color) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data).map((v, i) => i === 3 ? v / 255 : v);
      };
      const over = (front, back) => [0, 1, 2].map((i) => front[i] * front[3] + back[i] * (1 - front[3])).concat(1);
      const background = (node) => node ? over(rgba(getComputedStyle(node).backgroundColor), background(node.parentElement)) : [255, 255, 255, 1];
      const luminance = (color) => color.slice(0, 3).map((v) => {
        const n = v / 255;
        return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
      const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
      const style = getComputedStyle(element);
      const adjacent = background(element.parentElement);
      const fill = background(element);
      const border = over(rgba(style.borderTopColor), fill);
      const hasBorder = parseFloat(style.borderTopWidth) > 0 && !["none", "hidden"].includes(style.borderTopStyle);
      const icons = [...element.querySelectorAll("svg")].map((svg) => {
        const icon = getComputedStyle(svg);
        return contrast(over(rgba(icon.stroke !== "none" ? icon.stroke : icon.fill), fill), fill);
      });
      const textNodes = [...element.querySelectorAll("span, rt")].filter((node) => getComputedStyle(node).display !== "none" && node.getClientRects().length);
      const text = Math.min(...[element, ...textNodes].map((node) => contrast(over(rgba(getComputedStyle(node).color), fill), fill)));
      return {
        text, icons,
        hasText: element.textContent.trim().length > 0,
        boundary: Math.max(contrast(fill, adjacent), hasBorder ? contrast(border, adjacent) : 0),
        focus: contrast(over(rgba(style.outlineColor), adjacent), adjacent),
        focusVisible: element.matches(":focus-visible"),
        hover: element.matches(":hover"), active: element.matches(":active"),
        outlineWidth: parseFloat(style.outlineWidth), outlineStyle: style.outlineStyle,
        disabled: element.disabled, busy: element.getAttribute("aria-busy"),
      };
    });
    if (state === "active") {
      await page.mouse.move(0, 0);
      await page.mouse.up();
    }
    counts[label.split(" ")[0]] = (counts[label.split(" ")[0]] ?? 0) + 1;
    console.log(label, state, JSON.stringify(result), disabled ? "inactive: WCAG contrast exemption" : "");
    if (disabled) {
      if (result.focusVisible) failures.push(`${label}: disabled control received focus`);
      continue;
    }
    if (result.text < 4.5) failures.push(`${label} ${state}: text ${result.text.toFixed(3)} < 4.5`);
    if (result.icons.some((ratio) => ratio < 3)) failures.push(`${label} ${state}: icon < 3`);
    // 文字かアイコンで操作を識別できるボタンの枠線は装飾であり、
    // 境界だけが識別手段となる操作でのみ1.4.11の境界基準を要求する。
    if (!result.hasText && result.icons.length === 0 && result.boundary < 3) {
      failures.push(`${label} ${state}: boundary ${result.boundary.toFixed(3)} < 3`);
    }
    if ((state === "hover" || state === "active") && !result.hover) failures.push(`${label}: hover not exercised`);
    if (state === "active" && !result.active) failures.push(`${label}: active not exercised`);
    if (state === "focus" && (!result.focusVisible || result.outlineWidth < 2 || result.outlineStyle === "none" || result.focus < 3)) {
      failures.push(`${label}: keyboard focus ${JSON.stringify(result)}`);
    }
  }
}

try {
  const app = await browser.newPage();
  await app.setViewport({ width: 1280, height: 1000 });
  await app.goto(url, { waitUntil: "networkidle2" });
  assert.equal(await app.evaluate(() => matchMedia("(hover: hover)").matches), true);
  await app.waitForSelector(".my-toggle", { timeout: 30000 });
  assert.ok(await app.$(sharedSelector), "actual shared Button marker must exist; no synthetic replacement is permitted");
  for (const value of ["default", "cupcake", "dark"]) {
    await theme(app, value);
    await assertColorScope(app);
    const ruby = await app.$(".my-toggle");
    const seen = new Set();
    for (let i = 0; i < 2; i++) {
      const text = await ruby.evaluate((element) => element.textContent.trim());
      seen.add(text);
      const controls = await app.$$(sharedSelector);
      assert.ok(controls.length > 0, "actual application shared Buttons must be rendered");
      for (const [index, button] of controls.entries()) {
        if (await button.isVisible()) await measure(app, button, `app ${value} ${text} Button-${index}`);
      }
      await measure(app, ruby, `app ${value} ${text}`);
      await ruby.click();
      await pause();
    }
    assert.equal(seen.size, 2, "actual Rubyful toggle must change ON/OFF state");
    assert.ok([...seen].some((text) => text.includes("ON")));
    assert.ok([...seen].some((text) => text.includes("OFF")));
  }

  // The integration fixture imports production Button, but is not an application screen.
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(), loader: "tsx",
      contents: `import React from "react";
import {createRoot} from "react-dom/client";
import Button from "./src/components/ui/Button.tsx";
const icon = <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16M12 4v16"/></svg>;
const cases = ["text", "icon", "joined-text", "joined-icon", "loading", "disabled"];
createRoot(document.getElementById("component-fixture")).render(<>{[false,true].flatMap(secondary => cases.map(kind => <div key={secondary+kind} style={{padding:24,background:"var(--color-base-100)"}} className={kind.startsWith("joined") ? "join" : ""}>
<Button secondary={secondary} iconOnly={kind.includes("icon")} joined={kind.startsWith("joined")} className={kind.startsWith("joined") ? "join-item h-11" : ""} loading={kind==="loading"} disabled={kind==="disabled"} testId={(secondary?"secondary":"primary")+"-"+kind} aria-label={kind.includes("icon")?"追加":undefined}>{kind.includes("icon") ? icon : "検索"}</Button>
{kind.startsWith("joined") && <Button secondary={secondary} joined className="join-item h-11">隣接</Button>}
</div>))}</>);`,
    },
    bundle: true, write: false, platform: "browser", format: "iife", define: { "process.env.NODE_ENV": '"production"' },
  });
  const fixture = await browser.newPage();
  await fixture.setViewport({ width: 1280, height: 1000 });
  await fixture.goto(url, { waitUntil: "networkidle2" });
  await fixture.evaluate(() => {
    const root = document.createElement("section");
    root.id = "component-fixture";
    root.style.cssText = "position:relative;z-index:99999;display:flex;flex-wrap:wrap;background:var(--color-base-100)";
    const toggle = document.querySelector(".my-toggle");
    if (!toggle) throw new Error("actual Rubyful toggle is required for component integration");
    document.body.replaceChildren(root, toggle);
  });
  await fixture.addScriptTag({ content: bundle.outputFiles[0].text });
  await fixture.waitForSelector("[data-testid=primary-text]");
  await fixture.evaluate(() => {
    for (const label of document.querySelectorAll("#component-fixture .ruby-text")) window.RubyfulV2.processElement(label);
  });
  await fixture.waitForSelector("#component-fixture ruby rt");
  for (const value of ["default", "cupcake", "dark"]) {
    await theme(fixture, value);
    await assertColorScope(fixture);
    const ruby = await fixture.$(".my-toggle");
    const seen = new Set();
    for (let i = 0; i < 2; i++) {
      const rubyState = await ruby.evaluate((element) => element.textContent.trim());
      seen.add(rubyState);
      for (const button of await fixture.$$("#component-fixture button[data-testid]")) {
        const id = await button.evaluate((element) => element.dataset.testid);
        assert.equal(await button.evaluate((element, selector) => element.matches(selector), sharedSelector), true);
        if (id.endsWith("loading")) assert.equal(await button.evaluate((element) => element.getAttribute("aria-busy")), "true");
        if (id.endsWith("loading") || id.endsWith("disabled")) assert.equal(await button.evaluate((element) => element.disabled), true);
        await measure(fixture, button, `component-integration ${value} ${rubyState} ${id}`);
      }
      await ruby.click();
      await pause();
    }
    assert.equal(seen.size, 2, "component integration must exercise both actual Rubyful states");
  }
  console.log("Coverage (measured control states):", counts);
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
}
