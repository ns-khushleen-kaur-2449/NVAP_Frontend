import { useAuth } from '@/lib/AuthContext';
import { featuresEnabled } from '@/lib/rbac';

/** What a page shows in place of a feature switched off for the tenant. */
export function FeatureOff({ name }) {
  return (
    <div role="status" className="mx-auto max-w-md px-6 py-16 text-center">
      <h2 className="text-base font-semibold text-foreground">{name} isn't available</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        It's switched off for your organisation. Contact your platform administrator to turn it on.
      </p>
    </div>
  );
}

/** Shows `children` only while every one of `features` is on for the user's tenant. */
export default function FeatureRoute({ features, name, children }) {
  const { user } = useAuth();
  return featuresEnabled(user, features) ? children : <FeatureOff name={name} />;
}
