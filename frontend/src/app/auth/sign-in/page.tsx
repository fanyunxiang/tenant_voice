import SignInClient from './SignInClient';

type SignInPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
    reason?: string | string[];
  }> | {
    next?: string | string[];
    reason?: string | string[];
  };
};

const firstSearchParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = await searchParams;
  const next = firstSearchParam(resolvedSearchParams?.next);
  const reason = firstSearchParam(resolvedSearchParams?.reason);

  return <SignInClient nextPath={next} reason={reason} />;
}
