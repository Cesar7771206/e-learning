'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { GraduationCap, BookOpen, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    try {
      if (isSignUp) {
        // Registro
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split('@')[0], // Nombre temporal
              role: role, // ¡IMPORTANTE! Esto activa tu trigger en la DB
            },
          },
        })
        if (error) throw error
        setMsg('¡Cuenta creada! Revisa tu correo o inicia sesión.')
      } else {
        // Login
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-full">
              {role === 'student' ? <GraduationCap className="text-white w-8 h-8" /> : <BookOpen className="text-white w-8 h-8" />}
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">E-Learning AI</h1>
          <p className="text-gray-500">
            {isSignUp ? 'Crea tu cuenta para comenzar' : 'Bienvenido de nuevo'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {/* Selector de Rol (Solo en registro) */}
          {isSignUp && (
            <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  role === 'student' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
                }`}
              >
                Soy Estudiante
              </button>
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  role === 'teacher' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
                }`}
              >
                Soy Docente
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {msg && <p className="text-sm text-center text-red-500">{msg}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="ml-2 text-blue-600 font-semibold hover:underline"
          >
            {isSignUp ? 'Inicia Sesión' : 'Regístrate'}
          </button>
        </div>
      </div>
    </div>
  )
}