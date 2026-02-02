export {};

declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: {
        kind: number;
        created_at: number;
        tags: string[][];
        content: string;
        pubkey?: string;
        id?: string;
        sig?: string;
      }) => Promise<{ id: string; sig: string; pubkey: string } & Record<string, unknown>>;
    };
  }
}
