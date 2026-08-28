interface RubyfulV2InitOptions {
  selector: string;
  defaultDisplay: boolean;
  observeChanges: boolean;
  styles: {
    toggleButtonClass: string;
    toggleButtonText: {
      on: string;
      off: string;
    };
  };
}

interface RubyfulV2 {
  init(options: RubyfulV2InitOptions): void;
}

declare global {
  interface Window {
    RubyfulV2?: RubyfulV2;
  }
}

export {};
