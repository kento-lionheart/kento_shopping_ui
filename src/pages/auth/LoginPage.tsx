import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const fieldInputClass =
  'border-white/20 text-white placeholder:text-white/40 focus-visible:border-cta focus-visible:ring-cta/30';

type FieldName = 'email' | 'password';

type FieldErrors = Partial<Record<FieldName, string>>;

function validate(values: { email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.email.trim()) {
    errors.email = 'Email is required';
  }

  if (!values.password) {
    errors.password = 'Password is required';
  }

  return errors;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: Location })?.from?.pathname;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = validate({ email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const auth = await login({ email, password });
      if (from) {
        // A previous page sent the guest here (e.g. a protected route) — return
        // there over any role-based default, regardless of who logged in.
        navigate(from, { replace: true });
      } else if (!(auth.roles ?? []).includes('CUSTOMER')) {
        // No shopping capability at all (e.g. ADMIN, or a staff-only account) —
        // send straight to the admin dashboard instead of the customer home page.
        // A dual-role account (CUSTOMER + staff) still has CUSTOMER and lands on '/' instead.
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
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
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
                autoComplete="email"
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                className={fieldInputClass}
              />
              {fieldErrors.email && (
                <p id="email-error" role="alert" className="text-sm text-red-400">
                  {fieldErrors.email}
                </p>
              )}
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
                autoComplete="current-password"
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                className={fieldInputClass}
              />
              {fieldErrors.password && (
                <p id="password-error" role="alert" className="text-sm text-red-400">
                  {fieldErrors.password}
                </p>
              )}
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
