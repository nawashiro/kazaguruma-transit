// uncryptoモジュールのモック
const MockCrypto = {
  getRandomValues: (array) => array,
  randomUUID: () => "random-uuid-mock",
  subtle: {
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    generateKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
};

export default MockCrypto;
export const getRandomValues = MockCrypto.getRandomValues;
export const randomUUID = MockCrypto.randomUUID;
export const subtle = MockCrypto.subtle;
