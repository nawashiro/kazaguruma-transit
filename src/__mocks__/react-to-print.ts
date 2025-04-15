export const mockReactToPrint = jest.fn();

// useReactToPrintのモックを作成
export const useReactToPrint = jest
  .fn()
  .mockImplementation(() => mockReactToPrint);
