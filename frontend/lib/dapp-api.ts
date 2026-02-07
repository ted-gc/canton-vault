export type Cip0103Provider = {
  enable: () => Promise<void>;
  getPrimaryAccount: () => Promise<string>;
  prepareExecute: (args: {
    contractId: string;
    method: string;
    args: unknown[];
  }) => Promise<{ submit: () => Promise<unknown> }>;
};

declare global {
  interface Window {
    canton?: {
      dapp?: Cip0103Provider;
    };
  }
}

export function getProvider(): Cip0103Provider | null {
  if (typeof window === "undefined") return null;
  return window.canton?.dapp ?? null;
}

export async function connect(): Promise<Cip0103Provider> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("CIP-0103 provider not found");
  }
  await provider.enable();
  return provider;
}

export async function getPrimaryAccount(): Promise<string> {
  const provider = await connect();
  return provider.getPrimaryAccount();
}

export async function prepareExecute(params: {
  contractId: string;
  method: string;
  args: unknown[];
}) {
  const provider = await connect();
  return provider.prepareExecute(params);
}
