'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { chatWithGemini } from '../actions' // Importamos la Server Action
import { 
  LogOut, Plus, MessageSquare, Book, User, 
  Send, Bot, GraduationCap, Calendar, BookOpen 
} from 'lucide-react'

// Tipos básicos para TypeScript
type Profile = { id: string, role: 'student' | 'teacher', full_name: string }
type Course = { id: number, title: string, description: string, created_by: string }
type Message = { role: 'user' | 'model', content: string }

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [view, setView] = useState<'courses' | 'chat' | 'create'>('courses')
  
  // Estados de datos
  const [courses, setCourses] = useState<Course[]>([])
  const [myCourses, setMyCourses] = useState<Course[]>([]) // Cursos inscritos o creados
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  
  // Estados Chat
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Estados Creación Curso
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [newCourseDesc, setNewCourseDesc] = useState('')

  // 1. Cargar Usuario y Perfil
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      setProfile(profile)
      fetchCourses(profile?.role, user.id)
    }
    getUser()
  }, [])

  // 2. Fetch Cursos según Rol
  const fetchCourses = async (role: string | undefined, userId: string) => {
    if (role === 'teacher') {
      // Docente ve SUS cursos creados
      const { data } = await supabase.from('courses').select('*').eq('created_by', userId)
      setMyCourses(data || [])
    } else {
      // Estudiante ve sus inscripciones
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('course_id, courses(*)')
        .eq('student_id', userId)
      
      // Mapear la respuesta anidada
      const enrolled = enrollmentData?.map((e: any) => e.courses) || []
      setMyCourses(enrolled)

      // Y cargar todos los disponibles para inscribirse
      const { data: allData } = await supabase.from('courses').select('*')
      setCourses(allData || [])
    }
  }

  // 3. Crear Curso (Solo Docentes)
  const createCourse = async () => {
    if (!profile || profile.role !== 'teacher') return
    const { error } = await supabase.from('courses').insert({
      title: newCourseTitle,
      description: newCourseDesc,
      created_by: user.id
    })
    if (!error) {
      alert('Curso creado!')
      setNewCourseTitle('')
      setNewCourseDesc('')
      fetchCourses('teacher', user.id)
      setView('courses')
    }
  }

  // 4. Inscribirse en Curso (Solo Estudiantes)
  const enrollCourse = async (courseId: number) => {
    const { error } = await supabase.from('enrollments').insert({
      student_id: user.id,
      course_id: courseId
    })
    if (error) alert('Error al inscribirse')
    else {
      alert('¡Inscrito!')
      fetchCourses('student', user.id)
    }
  }

  // 5. Manejar Chat AI
  const handleSendMessage = async () => {
    if (!inputMsg.trim() || !selectedCourse) return

    const newMsg = { role: 'user', content: inputMsg } as Message
    setMessages(prev => [...prev, newMsg])
    setInputMsg('')
    setAiLoading(true)

    // Guardar en BD (Opcional, para historial persistente)
    // await supabase.from('ai_messages').insert(...)

    // Llamar a Gemini (Server Action)
    const response = await chatWithGemini(
      newMsg.content, 
      selectedCourse.title + ": " + selectedCourse.description, 
      messages
    )

    if (response.success) {
      setMessages(prev => [...prev, { role: 'model', content: response.message }])
    }
    setAiLoading(false)
  }

  // Scroll automático al chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])


  // --- RENDERIZADO DE INTERFAZ ---
  if (!profile) return <div className="flex justify-center items-center h-screen">Cargando perfil...</div>

  return (
    <div className="flex h-screen bg-gray-50">
      
      {/* SIDEBAR SIMPLE */}
      <aside className="w-64 bg-white border-r shadow-sm flex flex-col">
        <div className="p-6 border-b flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <GraduationCap className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl text-gray-800">E-Learn</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setView('courses')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'courses' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Book className="w-5 h-5" /> Mis Cursos
          </button>
          
          {profile.role === 'student' && (
             <button onClick={() => setView('create')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'create' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
               <Plus className="w-5 h-5" /> Explorar Cursos
             </button>
          )}

          {profile.role === 'teacher' && (
            <button onClick={() => setView('create')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'create' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Plus className="w-5 h-5" /> Crear Curso
            </button>
          )}

          <div className="mt-8 px-4 text-xs font-semibold text-gray-400 uppercase">Herramientas</div>
          {/* Solo mostramos el botón de chat si hay un curso seleccionado */}
          {selectedCourse && (
            <button onClick={() => setView('chat')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'chat' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600'}`}>
              <Bot className="w-5 h-5" /> Tutor AI: {selectedCourse.title}
            </button>
          )}
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{profile.role === 'teacher' ? 'Docente' : 'Estudiante'}</p>
            </div>
          </div>
          <button 
            onClick={() => supabase.auth.signOut().then(() => router.push('/'))} 
            className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 py-2 rounded-lg text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto p-8">
        
        {/* VISTA: LISTA DE CURSOS (Dashboard) */}
        {view === 'courses' && (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              {profile.role === 'student' ? 'Mis Inscripciones' : 'Mis Cursos Impartidos'}
            </h2>
            
            {myCourses.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                <Book className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No tienes cursos activos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myCourses.map((course) => (
                  <div key={course.id} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
                    <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                      <BookOpen className="text-blue-600 w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-800 mb-2">{course.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
                    
                    <button 
                      onClick={() => {
                        setSelectedCourse(course)
                        setView('chat')
                        setMessages([]) // Limpiar chat previo
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Bot className="w-4 h-4" /> Abrir Tutor AI
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VISTA: CREAR CURSO (Docente) o EXPLORAR (Estudiante) */}
        {view === 'create' && (
          <div>
             {profile.role === 'teacher' ? (
               <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border">
                 <h2 className="text-2xl font-bold mb-6">Crear Nuevo Curso</h2>
                 <div className="space-y-4">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Título del Curso</label>
                     <input 
                        className="w-full px-4 py-2 border rounded-lg"
                        value={newCourseTitle}
                        onChange={e => setNewCourseTitle(e.target.value)}
                        placeholder="Ej: Introducción a React"
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                     <textarea 
                        className="w-full px-4 py-2 border rounded-lg h-32"
                        value={newCourseDesc}
                        onChange={e => setNewCourseDesc(e.target.value)}
                        placeholder="¿De qué trata el curso?"
                     />
                   </div>
                   <button onClick={createCourse} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                     Publicar Curso
                   </button>
                 </div>
               </div>
             ) : (
               <div>
                  <h2 className="text-2xl font-bold mb-6">Cursos Disponibles</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {courses.map(course => (
                      <div key={course.id} className="bg-white p-6 rounded-xl border">
                        <h3 className="font-bold">{course.title}</h3>
                        <p className="text-gray-500 text-sm mt-2 mb-4">{course.description}</p>
                        
                        {myCourses.find(c => c.id === course.id) ? (
                          <span className="text-green-600 text-sm font-semibold">Ya inscrito</span>
                        ) : (
                          <button onClick={() => enrollCourse(course.id)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm w-full">
                            Inscribirse
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
               </div>
             )}
          </div>
        )}

        {/* VISTA: CHAT CON IA (Tutoría) */}
        {view === 'chat' && selectedCourse && (
          <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-indigo-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-indigo-900">Tutor Virtual: {selectedCourse.title}</h3>
                <p className="text-xs text-indigo-600">Pregunta dudas o pide ejercicios.</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
               {messages.length === 0 && (
                 <div className="text-center text-gray-400 py-10">
                   <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
                   <p>¡Hola! Soy tu tutor de {selectedCourse.title}.</p>
                   <p className="text-sm">Pregúntame algo o dime "Dame un ejercicio".</p>
                 </div>
               )}
               
               {messages.map((msg, i) => (
                 <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] p-3 rounded-2xl ${
                     msg.role === 'user' 
                       ? 'bg-blue-600 text-white rounded-br-none' 
                       : 'bg-white border text-gray-800 rounded-bl-none shadow-sm'
                   }`}>
                     {/* Render simple de saltos de línea */}
                     <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                   </div>
                 </div>
               ))}
               
               {aiLoading && (
                 <div className="flex justify-start">
                   <div className="bg-white p-3 rounded-2xl rounded-bl-none border shadow-sm flex gap-1 items-center">
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
                   </div>
                 </div>
               )}
               <div ref={chatEndRef} />
            </div>

            <div className="p-4 border-t bg-white">
              <div className="flex gap-2">
                <input 
                  className="flex-1 px-4 py-2 border rounded-full focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Escribe tu duda..."
                  value={inputMsg}
                  onChange={e => setInputMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  disabled={aiLoading}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={aiLoading || !inputMsg.trim()}
                  className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}