import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[#1C1917] to-[#3a2f1f] px-4">
      <Card className="w-full max-w-sm border-white/10 bg-[rgba(28,25,23,0.6)] shadow-2xl backdrop-blur-2xl backdrop-saturate-150">
        <CardHeader>
          <p className="text-xs font-medium tracking-[0.3em] text-cta uppercase">Kento</p>
          <CardTitle className="font-heading text-3xl font-medium text-white">Log in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* red-400, not text-destructive: the token's #DC2626 fails contrast on this dark glass card */}
            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-white/80">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="border-white/20 text-white placeholder:text-white/40 focus-visible:border-cta focus-visible:ring-cta/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-white/80">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="border-white/20 text-white placeholder:text-white/40 focus-visible:border-cta focus-visible:ring-cta/30"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 bg-cta text-cta-foreground hover:bg-cta/90"
            >
              {isSubmitting ? 'Logging in…' : 'Log in'}
            </Button>

            <p className="text-center text-sm text-white/60">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-cta hover:underline">
                Register
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
