import { useAuth } from '@/auth/useAuth';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Welcome{user?.fullName ? `, ${user.fullName}` : ''}</h1>
    </div>
  );
}
