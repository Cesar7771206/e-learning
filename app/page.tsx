'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { GraduationCap, BookOpen, Loader2, Sun, Moon, Eye, EyeOff } from 'lucide-react'
import { useTheme } from 'next-themes'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split('@')[0],
              role: role,
            },
          },
        })
        if (error) throw error
        if (data.session) {
          router.push('/dashboard')
        } else {
          setMsg('¡Cuenta creada! Revisa tu correo o inicia sesión.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/dashboard')
      }
    } catch (error: any) {
      setMsg(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* IMAGEN DE FONDO TIPO PAISAJE OSCURO */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2070&auto=format&fit=crop')",
        }}
      >
        {/* Capa oscura para asegurar contraste */}
        <div className="absolute inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-[2px]"></div>
      </div>

      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="absolute top-6 right-6 z-20 p-2 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all border border-white/10"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* TARJETA GLASSMORPHISM */}
      <div className="relative z-10 w-full max-w-md p-8 rounded-2xl shadow-2xl border border-white/10 bg-white/10 backdrop-blur-xl animate-fade-in-up">

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-3 rounded-full shadow-lg shadow-blue-500/30">
              {role === 'student' ? <GraduationCap className="text-white w-8 h-8" /> : <BookOpen className="text-white w-8 h-8" />}
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">
            E-Learning AI
          </h1>
          <p className="text-blue-200 mt-2 font-light">
            {isSignUp ? 'Comienza tu viaje de aprendizaje' : 'Bienvenido de nuevo, explorador'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-5">
          {isSignUp && (
            <div className="flex bg-black/20 p-1 rounded-xl mb-4 border border-white/5">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${role === 'student' ? 'bg-white text-blue-900 shadow-md' : 'text-gray-300 hover:text-white'
                  }`}
              >
                Estudiante
              </button>
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${role === 'teacher' ? 'bg-white text-blue-900 shadow-md' : 'text-gray-300 hover:text-white'
                  }`}
              >
                Docente
              </button>
            </div>
          )}

          <div className="space-y-4">
            <div className="relative group">
              <label className="block text-xs font-bold text-blue-200 mb-1 uppercase tracking-wider ml-1">Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-gray-400 transition-all group-hover:bg-black/50 backdrop-blur-sm"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative group">
              <label className="block text-xs font-bold text-blue-200 mb-1 uppercase tracking-wider ml-1">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-white placeholder-gray-400 transition-all group-hover:bg-black/50 backdrop-blur-sm pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          {msg && (
            <div className="bg-red-500/20 border border-red-500/50 p-3 rounded-lg">
              <p className="text-sm text-center text-red-200 font-medium">{msg}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-900/50 transition-all transform hover:scale-[1.02] active:scale-95 flex justify-center items-center mt-6"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (isSignUp ? 'Crear Cuenta' : 'Ingresar al Sistema')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-300">
            {isSignUp ? '¿Ya eres miembro?' : '¿Aún no tienes cuenta?'}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-2 text-blue-300 font-bold hover:text-white hover:underline transition-colors"
            >
              {isSignUp ? 'Inicia Sesión' : 'Regístrate Gratis'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}