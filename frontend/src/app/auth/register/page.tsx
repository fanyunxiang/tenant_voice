import RegisterClient from './RegisterClient';

type RegisterSearchParams = {
  email?: string | string[];
  next?: string | string[];
  step?: string | string[];
};

type RegisterPageProps = {
  searchParams?: Promise<RegisterSearchParams> | RegisterSearchParams;
};

const firstSearchParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const resolvedSearchParams = await searchParams;
  const email = firstSearchParam(resolvedSearchParams?.email);
  const next = firstSearchParam(resolvedSearchParams?.next);
  const step = firstSearchParam(resolvedSearchParams?.step);

  return (
    <RegisterClient
      initialEmail={email}
      initialStep={step === 'verify' ? 'email_sent' : 'register'}
      nextPath={next}
    />
  );
}
