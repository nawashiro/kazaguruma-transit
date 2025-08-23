import type { Event } from "nostr-tools";
import { isValidNpub, npubToHex } from "@/lib/nostr/nostr-utils";
import { naddrEncode } from "@/lib/nostr/naddr-utils";
import { logger } from "@/utils/logger";

export interface DiscussionCreationForm {
  title: string;
  description: string;
  moderators: string[];
  dTag?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface CreationFlowParams {
  formData: DiscussionCreationForm;
  userPubkey: string;
  adminPubkey: string;
  signEvent: (event: Partial<Event>) => Promise<Event>;
  publishEvent: (event: Event) => Promise<boolean>;
}

export interface CreationFlowResult {
  success: boolean;
  discussionNaddr?: string;
  errors: string[];
  successMessage?: string;
}

export function validateDiscussionCreationForm(
  form: DiscussionCreationForm
): ValidationResult {
  const errors: string[] = [];

  if (!form.title?.trim()) {
    errors.push("タイトルは必須です");
  } else if (form.title.length > 100) {
    errors.push("タイトルは100文字以内で入力してください");
  }

  if (!form.description?.trim()) {
    errors.push("説明は必須です");
  } else if (form.description.length > 500) {
    errors.push("説明は500文字以内で入力してください");
  }

  if (form.moderators && form.moderators.length > 0) {
    const invalidModerators = form.moderators.filter(
      (mod) => !isValidNpub(mod)
    );
    if (invalidModerators.length > 0) {
      errors.push("無効なモデレーターIDが含まれています");
    }
  }

  // ID is now required
  if (!form.dTag || !form.dTag.trim()) {
    errors.push("IDは必須です");
  } else {
    const dTagTrimmed = form.dTag.trim();
    if (dTagTrimmed.length < 3 || dTagTrimmed.length > 100) {
      errors.push("IDは3文字以上100文字以内で入力してください");
    } else if (!/^[a-z0-9-]+$/.test(dTagTrimmed)) {
      errors.push("IDは小文字英数字、ハイフンのみ使用できます");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function createDiscussionCreationEvent(
  form: DiscussionCreationForm,
  userPubkey: string
): Partial<Event> {
  // ID is now required and validated above, so we can safely use it
  const dTag = form.dTag!.trim();

  const tags: string[][] = [
    ["d", dTag],
    ["name", form.title.trim()],
    ["description", form.description.trim()],
  ];

  if (form.moderators && form.moderators.length > 0) {
    form.moderators.forEach((moderatorNpub) => {
      const hexPubkey = npubToHex(moderatorNpub);
      tags.push(["p", hexPubkey, "", "moderator"]);
    });
  }

  return {
    kind: 34550,
    content: form.description.trim(),
    tags,
    pubkey: userPubkey,
    created_at: Math.floor(Date.now() / 1000),
  };
}

export function createDiscussionListingRequest(
  form: DiscussionCreationForm,
  discussionNaddr: string,
  adminPubkey: string,
  userPubkey: string
): Partial<Event> {
  const discussionListNaddr = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;
  if (!discussionListNaddr) {
    throw new Error("NEXT_PUBLIC_DISCUSSION_LIST_NADDR is required");
  }

  // Parse discussion list naddr to get pubkey
  const discussionListPubkey = adminPubkey; // Assuming admin manages the discussion list

  const tags: string[][] = [
    // NIP-72 requires uppercase tags for community definition
    ["A", discussionListNaddr],
    ["P", discussionListPubkey],
    ["K", "34550"],
    
    // NIP-72 requires lowercase tags for the specific post/discussion
    ["a", discussionNaddr],
    ["p", discussionListPubkey],
    ["k", "34550"],
    
    // Spec requirement: q tag for user-created kind:34550 reference
    ["q", discussionNaddr]
  ];

  // NIP-72 compliant: content should only contain the nostr: URI
  const content = `nostr:${discussionNaddr}`;

  return {
    kind: 1111, // NIP-72 requires kind:1111 for community posts
    content,
    tags,
    pubkey: userPubkey,
    created_at: Math.floor(Date.now() / 1000),
  };
}

export async function processDiscussionCreationFlow(
  params: CreationFlowParams
): Promise<CreationFlowResult> {
  try {
    const validation = validateDiscussionCreationForm(params.formData);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    const discussionEvent = createDiscussionCreationEvent(
      params.formData,
      params.userPubkey
    );

    let signedDiscussionEvent: Event;
    try {
      signedDiscussionEvent = await params.signEvent(discussionEvent);
    } catch (error) {
      logger.error("Failed to sign discussion event:", error);
      return {
        success: false,
        errors: ["イベントの署名に失敗しました"],
      };
    }

    const discussionPublished = await params.publishEvent(
      signedDiscussionEvent
    );
    if (!discussionPublished) {
      return {
        success: false,
        errors: ["リレーへの投稿に失敗しました"],
      };
    }

    const dTag = discussionEvent.tags?.find((tag) => tag[0] === "d")?.[1];
    if (!dTag) {
      return {
        success: false,
        errors: ["会話IDの生成に失敗しました"],
      };
    }

    const discussionNaddr = naddrEncode({
      identifier: dTag,
      pubkey: params.userPubkey,
      kind: 34550,
    });

    const listingRequest = createDiscussionListingRequest(
      params.formData,
      discussionNaddr,
      params.adminPubkey,
      params.userPubkey
    );

    let signedListingRequest: Event;
    try {
      signedListingRequest = await params.signEvent(listingRequest);
    } catch (error) {
      logger.error("Failed to sign listing request:", error);
      return {
        success: false,
        errors: ["掲載リクエストの署名に失敗しました"],
      };
    }

    const requestPublished = await params.publishEvent(signedListingRequest);
    if (!requestPublished) {
      return {
        success: false,
        errors: ["掲載リクエストの送信に失敗しました"],
      };
    }

    const successMessage = `
会話が作成されました。すぐに開始できます。URLを共有すれば、仲間を呼び込めます。

まずは話題の呼び水として、10個程度の書き込みをしてみてください。なるべく簡単なものを書き込むと、他の人が参加しやすくなります。

会話一覧への掲載は、少々お待ちください。
    `.trim();

    return {
      success: true,
      discussionNaddr,
      errors: [],
      successMessage,
    };
  } catch (error) {
    logger.error("Discussion creation flow failed:", error);
    return {
      success: false,
      errors: ["会話作成中に予期しないエラーが発生しました"],
    };
  }
}
