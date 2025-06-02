
import { Flower } from 'lucide-react';

const AppLogo = () => {
  return (
    <div className="flex items-center gap-2" aria-label="DataFill Logo">
      <Flower className="h-7 w-7 text-primary" />
      <span className="text-2xl font-semibold tracking-tight text-foreground">
        DataFill
      </span>
      <span className="ml-1.5 text-xs font-medium text-accent-foreground bg-accent px-1.5 py-0.5 rounded-sm">
        beta
      </span>
    </div>
  );
};

export default AppLogo;
