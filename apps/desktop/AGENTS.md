# Desktop — General Rules

The desktop is the local interface of Weber Nexus.

## Responsibilities

- Local login/connection.
- Local database configuration.
- Local UI that connects to local runtime/API
- Runtime health visualization.
- Display of time series data from InfluxDB via runtime/API.

## Rules

- Do not access SQLite directly through the UI.
- Do not access InfluxDB directly through the UI.
- Do not place Modbus rules in the UI.
- Do not place polling rules in the UI.
- The UI should display the following states: loading, empty, error, stale, and offline.
- All communication must go through the API/runtime.
- Validate forms with Zod when applicable.
- Do not assume internet access is available.

## Development Guide

- Always follow the theme.
- Follow the SOLID principles and Clean Code.
- Always make a good use of componentization.
- Prefer composition pattern if possible.
- If a refactor is requested, always keep the functionality working.

## 🎯 Project Overview

**Tech Stack:**

- Electron v30 (cross-platform desktop UI)
- Vite 5 (build tool)
- React 18.2 + TypeScript 5.2 (strict mode)
- TailwindCSS (styling)
- TanStack Query v5 (React Query)
- React Hook Form + Zod resolver
- TanStack Route v1 (Routing)
- Zod (validation)
- Axios (HTTP lib)

---

## 📁 Folder Structure

```text
public/                  # Static images, SVGs, videos
installer/               # NSIS Installer configurations
types/                   # TypeScript type definitions (.type.ts)
electron/                # Electron main/preload configuration
src/
├── assets/              # Local images, SVGs, videos
├── components/
│   └── shared/          # Reusable UI components
├── features/            # Feature-based UI components (ex: settings/dialog.tsx)
├── hooks/               # Custom hooks
│   └── react-query/     # TanStack Query hooks (queries & mutations)
├── routes/              # React Router file-based pages
├── lib/                 # Core functions (ex: Auth, Api)
├── utils/               # Utility functions
├── main.tsx             # Entry point
└── index.css            # CSS main entry and theme
```

**Key Principles:**

- Feature-based organization in `routes/`
- Shared components in `components/shared/`
- Colocate unit tests with source files
- Use `.type.ts` suffix for type-only files
- ALL TanStack Query hooks go in `hooks/`

---

## 🧩 Component Structure & Naming

### File Naming

- Components: `PascalCase.tsx` (e.g., `Button.tsx`, `UserCard.tsx`)
- Hooks: `camelCase.ts` (e.g., `useDebounce.ts`)
- Types: `camelCase.type.ts` (e.g., `role.type.ts`)
- Utils: `camelCase.ts` (e.g., `apiUrls.ts`)
- Constants: `PascalCase.ts` or `camelCase.ts`
- Tests: `matchesFileName.test.ts(x)`
- E2E Tests: `kebab-case.spec.ts`

### Component Pattern

```tsx
// 1. Imports (organized: React → external → internal → CSS)
import { useState, useCallback } from "react";
import { useMyCustomHook } from "../../hooks/useMyCustomHook";

// 2. Types/Interfaces
interface MyComponentProps {
  title: string;
  onSubmit: (data: FormData) => void;
  variant?: "primary" | "secondary";
}

// 3. Component (always destructure props in signature)
export const MyComponent = ({
  title,
  onSubmit,
  variant = "primary",
}: MyComponentProps) => {
  // 4. Hooks
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading } = useMyQuery();

  // 5. Handlers
  const handleClick = useCallback(() => {
    setIsOpen(true);
  }, []);

  // 6. Early returns (loading/error states)
  if (isLoading) return <Loading />;

  // 7. JSX
  return (
    <div>
      <p>{title}</p>
      {/* ... */}
    </div>
  );
};
```

### forwardRef Pattern

When components need to expose refs to parent components:

```tsx
import { forwardRef } from "react";

interface MyComponentProps {
  label: string;
  onClick?: () => void;
}

const MyComponent = forwardRef<HTMLDivElement, MyComponentProps>(
  ({ label, onClick }, ref) => {
    return (
      <div ref={ref} onClick={onClick}>
        {label}
      </div>
    );
  },
);

// RECOMMENDED: Set displayName for better debugging
MyComponent.displayName = "MyComponent";

export default MyComponent;
```

**When to use:**

- When parent needs to access DOM node
- When programmatically focusing elements
- When need to set internal state on deep or surface component

### Export Conventions

```tsx
// ✅ GOOD - Named exports (preferred for .ts files)
export const Button = ({ children }: Props) => <button>{children}</button>;

// ✅ GOOD - Default exports (allowed for all .tsx files per ESLint)
const Button = ({ children }: Props) => <button>{children}</button>;
export default Button;

// ✅ GOOD - Barrel exports for related components
// components/totalizer/index.ts
export const Totalizer = {
  Root: TotalizerRoot,
  Content: TotalizerContent,
};

// ⚠️ AVOID - Re-export everything (makes imports unclear)
export * from "./components";
```

## 🪝 Custom Hooks

### Hook Conventions

```tsx
// Always prefix with "use"
export const useFormState = () => {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Return object for multiple values
  return { value, setValue, error, setError };
};

// Return tuple for simple hooks
export const useToggle = (initial = false): [boolean, () => void] => {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue((v) => !v), []);
  return [value, toggle];
};
```

### React Hook Form Pattern

```tsx
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// 1. Zod schema
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  items: z.array(
    z.object({
      id: z.string(),
      value: z.string(),
    }),
  ),
});

type FormData = z.infer<typeof formSchema>;

// 2. Form hook
export const useMyForm = (defaultValues?: FormData) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onTouched", // Validate on blur
    defaultValues:
      defaultValues ||
      {
        /* defaults */
      },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  return { form, fields, append, remove };
};
```

### FormProvider Pattern

For nested forms or when form context needs to be shared:

```tsx
import { FormProvider, useFormContext } from "react-hook-form";

// Parent component
export const MyForm = () => {
  const methods = useForm<FormData>();

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <NestedFormField />
      </form>
    </FormProvider>
  );
};

// Child component
const NestedFormField = () => {
  const { register, formState } = useFormContext<FormData>();
  return <input {...register("fieldName")} />;
};
```

---

## 🌐 API & Data Fetching

### **CRITICAL: TanStack Query Rules**

1. ❌ **NEVER** use `useQuery` directly in components.
2. ✅ **ALWAYS** wrap `useMutation` in custom hooks in `hooks/` (convention enforced)
3. ✅ **ALWAYS** place all query/mutation hooks in `hooks/`

**Enforcement Details:**

- `useQuery`: Blocked by ESLint (hard enforcement) _if not blocked, create the block_
- `useMutation`: Blocked by ESLint (hard enforcement) _if not blocked, create the block_

### Query Hook Pattern

```tsx
// hooks/react-query/useUsers.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const useUsers = () => {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await api.get("/users");
      return userSchema.array().parse(data); // Zod validation
    },
  });
};
```

### Mutation Hook Pattern

```tsx
// hooks/react-query/useUpdateUser.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useUpdateUser = ({
  onSuccess,
  onSettled,
}: {
  onSuccess?: (data: User) => void;
  onSettled?: () => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (user: User) => {
      const { data } = await http.put(`/users/${user.id}`, user);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuario editado com sucesso.");
      onSuccess?.(data);
    },
    onError: () => {
      toast.error("Não foi possível atualizar o usuario.");
    },
    onSettled,
  });
};
```

### Query Keys

```tsx
// Define as constants or factory functions
const userKeys = {
  all: ["users"] as const,
  user: (id: number) => ["users", id] as const,
  byFeature: () => ["users", "auth"] as const,
};
```

**Important:** Query keys should only include dynamic parameters, never URLs.

```tsx
// ✅ GOOD - Only logical identifiers
queryKey: ["users", userId];

// ❌ BAD - Don't include URLs
queryKey: ["users", userId, url];
```

### HTTP Client

```tsx
import { api } from "@/lib/api";

// All requests should use axios api instance
const { data } = await api.get<User[]>("/users");
await api.post<User>("/users", newUser);
await api.put<User>(`/users/${id}`, updatedUser);
await api.delete(`/users/${id}`);
```

---

## 🔒 TypeScript Conventions

### Type Definitions

```tsx
// 1. File naming: .type.ts suffix
// role.type.ts
import { z } from "zod";

export const roleSchema = z.object({
  id: z.number(),
  name: z.string(),
  permissionIds: z.array(z.number()),
});

export type Role = z.infer<typeof roleSchema>;

// 2. Component props: interface with Props suffix
interface ButtonProps {
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

// 3. Enums: use string unions or as const
type Status = "pending" | "approved" | "rejected";

export const ROUTES = {
  HOME: "/",
  INBOUND: "/inbound",
} as const;
```

### Strict Rules

- ❌ **Minimize `any`** - Use `unknown` or proper types when possible
- ✅ **Strict mode enabled**
- ✅ **Destructure props in function signatures**
- ✅ **Use type inference where possible**

```tsx
// ✅ GOOD
export const processUser = ({ id, name }: { id: number; name: string }) => {
  // ...
};

// ⚠️ AVOID (but not currently enforced)
export const processUser = (user: any) => {
  // ...
};
```

### Exhaustive Type Checking

For switch statements and conditional logic:

```tsx
type EditType = "Create" | "Edit" | "Delete";

function handleEdit(editType: EditType) {
  switch (editType) {
    case "Create":
      return createItem();
    case "Edit":
      return updateItem();
    case "Delete":
      return deleteItem();
    default:
      return assertExhaustive(editType);
  }
}

// Ensures all cases are handled at compile time
function assertExhaustive(value: never): never {
  throw new Error(`Unhandled case: ${value}`);
}
```

---

## 📅 Date/Time Handling

### date-fns Configuration

Plugins initialized in `dayjsConfig.ts` (called in `main.tsx`):

- objectSupport, utc, timezone, toObject, weekOfYear, isoWeek

---

## 🧪 Testing Patterns

### Unit Tests (Vitest)

```tsx
// MyComponent.test.tsx
import { render, screen } from "@testing-library/react";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  it("should render the title", () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("should call onSubmit when button is clicked", async () => {
    const onSubmit = vi.fn();
    render(<MyComponent onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalled();
  });
});
```

**Conventions**:

- Colocate with source (`.test.ts(x)`)
- Use `describe` and `it`/`test`
- Test naming: descriptive sentences

### E2E Tests (Playwright)

```ts
// tests/mocked/feature/my-feature.spec.ts
import { test, expect } from "@playwright/test";

test("should display success message when form is submitted", async ({
  page,
}) => {
  await page.goto("/my-feature");
  await page.getByRole("textbox", { name: /name/i }).fill("John Doe");
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page.getByText(/success/i)).toBeVisible();
});
```

**Locator preference**:

1. `getByRole()` - Semantic roles (best)
2. `getByLabel()` - Form labels
3. `getByPlaceholder()` - Input placeholders
4. `getByText()` - Visible text
5. Avoid: test IDs, classes

---

## 🎨 Conditional Rendering Pattern

**Order is critical**:

```tsx
export const MyComponent = () => {
  const { data, isLoading, isError } = useMyQuery();

  // 1. Loading (first)
  if (isLoading) {
    return <Loading />;
  }

  // 2. Error (second)
  if (isError) {
    return (
      <ErrorDisplay
        primaryMessage={displayMessage.myFeature.error}
        secondaryMessage={displayMessage.default.internalError}
        showReloadOption
      />
    );
  }

  // 3. Empty (third)
  if (!data || data.length === 0) {
    return (
      <EmptyContentDisplay
        primaryMessage={displayMessage.myFeature.empty}
        secondaryMessage={displayMessage.default.emptyFilterResults}
      />
    );
  }

  // 4. Success (render content)
  return <Box>{/* actual content */}</Box>;
};
```

---

## 🧠 State Management

### React Context Pattern

```tsx
type MyContextValue = {
  data: MyData[];
  updateData: (data: MyData[]) => void;
};

const MyContext = createContext<MyContextValue | null>(null);

export function MyContextProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<MyData[]>([]);

  return (
    <MyContext.Provider value={{ data, updateData: setData }}>
      {children}
    </MyContext.Provider>
  );
}

// Custom hook with error handling
export function useMyContext(): MyContextValue {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error("useMyContext must be used within MyContextProvider");
  }
  return context;
}
```

---

## ⚡ Performance Optimization

### React.memo

```tsx
// ✅ Use for expensive, frequently re-rendered components
export const ExpensiveRow = memo(({ data }: Props) => {
  // Complex rendering
  return <div>{/* ... */}</div>;
});
```

### useMemo

```tsx
// ✅ GOOD - Expensive calculations
const sortedData = useMemo(
  () => data.sort((a, b) => a.name.localeCompare(b.name)),
  [data],
);

// ❌ BAD - Simple operations
const fullName = useMemo(
  () => `${firstName} ${lastName}`,
  [firstName, lastName],
);
```

### useCallback

```tsx
// ✅ GOOD - Passed to memoized children
const handleClick = useCallback(() => {
  doSomething(data);
}, [data]);

// ❌ BAD - Not in dependencies or passed to children
const handleSimpleClick = useCallback(() => {
  console.log("clicked");
}, []);
```

---

## 🔐 Security

### Log Sanitization

```tsx
import { sanitizeLog } from "./utils/logSanitizer";

// ✅ GOOD - Sanitized
console.error(sanitizeLog(userMessage));

// ❌ BAD - Direct logging
console.error(userMessage);
```

---

## 📋 Import Organization

```tsx
// 1. React
import { useState, useEffect } from "react";

// 2. External libraries (alphabetical)
import dayjs from "dayjs";

// 3. Internal imports (relative paths)
import { useMyHook } from "@/hooks/useMyHook";
import { MyType } from "../../types/myType.type";

// 4. CSS (last)
import "@/index.css";
```

### TODOs

```tsx
// ✅ GOOD - References ticket
// TODO(BOD-188): Refactor this component

// ❌ BAD
// TODO: Fix this later
```

---

## ⚠️ Common Pitfalls & Best Practices

### Strictly Enforced

1. ❌ Using `useQuery` directly in components → ✅ Wrap in custom hooks
2. ❌ Inline `style` prop → ✅ TailwindCSS classes or use defined ones at `index.css`

### Strongly Recommended

1. ⚠️ Using `any` type without justification
2. ⚠️ Deeply nested ternaries in JSX
3. ⚠️ Using `useEffect` for data fetching (prefer React Query)
4. ⚠️ Leaving commented-out code (remove or add explanation)
5. ⚠️ Including URLs in query keys (only dynamic params)
6. ⚠️ Direct `useMutation` in pages (wrap in custom hooks per convention)

### Flexible Guidelines

1. 🔵 Hardcoded z-index - acceptable for component-internal layering
2. 🔵 Hardcoded date formats - acceptable for format props
3. 🔵 TODOs - should reference JIRA tickets when possible

---

**Last Updated**: June 2026
