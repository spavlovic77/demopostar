import { LoginForm } from "@/components/login-form"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-xl">
        <LoginForm />
      </div>
    </div>
  )
}
