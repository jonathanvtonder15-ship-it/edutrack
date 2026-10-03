import { MadeWithBadgeComponent, BadgeProtection } from "./made-with-badge-client";

/**
 * DO NOT MODIFY OR DELETE THIS FILE
 */

async function checkSubscription(): Promise<boolean> {
  const runtimeUri = process.env.CODEWORDS_RUNTIME_URI;
  const apiKey = process.env.CODEWORDS_API_KEY;

  if (!runtimeUri || !apiKey) {
    return false;
  }

  try {
    const response = await fetch(`${runtimeUri}/subscription`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const data: { hasActiveSubscription: boolean } = await response.json();
    return data.hasActiveSubscription;
  } catch {
    return false;
  }
}

export async function MadeWithBadge() {
  const hasActiveSubscription = await checkSubscription();

  if (hasActiveSubscription) {
    return null;
  }

  return (
    <>
      <MadeWithBadgeComponent />
      <BadgeProtection />
    </>
  );
}
