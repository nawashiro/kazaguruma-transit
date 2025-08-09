// uncryptoモジュールのモック
const MockCrypto = {
  getRandomValues: (array) => array,
  subtle: {
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    generateKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
};

export default MockCrypto;
export const getRandomValues = MockCrypto.getRandomValues;
export const subtle = MockCrypto.subtle;
