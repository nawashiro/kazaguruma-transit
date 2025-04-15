// iron-session/nextのモック
export const ironSession = jest.fn((fn) => fn);

export const sealData = jest.fn().mockImplementation((data) => {
  return Promise.resolve(JSON.stringify(data));
});

export const unsealData = jest.fn().mockImplementation((data) => {
  try {
    return Promise.resolve(JSON.parse(data));
  } catch (e) {
    return Promise.resolve({ isLoggedIn: false });
  }
});
