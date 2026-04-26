import SignInClient from './SignInClient';

type SignInPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }> | {
    next?: string | string[];
  };
};

const firstSearchParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolvedSearchParams = await searchParams;
  const next = firstSearchParam(resolvedSearchParams?.next);

  return <SignInClient nextPath={next} />;
}
