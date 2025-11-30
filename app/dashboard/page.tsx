'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { chatWithGemini } from '../actions'
import { 
  LogOut, Plus, Book, User, Send, Bot, 
  GraduationCap, BookOpen, Sun, Moon, 
  MoreVertical, Search, AlertCircle, RefreshCw 
} from 'lucide-react'
import { useTheme } from 'next-themes'

// Tipos
type Profile = { id: string, role: 'student' | 'teacher', full_name: string, avatar_url?: string }
type Course = { id: number, title: string, description: string, created_by: string }
type Message = { role: 'user' | 'model', content: string, timestamp?: Date }

export default function Dashboard() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Estados de carga y usuario
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  
  // Estados de vista y datos
  const [view, setView] = useState<'courses' | 'chat' | 'create'>('courses')
  const [courses, setCourses] = useState<Course[]>([])
  const [myCourses, setMyCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  
  // Estados de formulario
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [newCourseDesc, setNewCourseDesc] = useState('')
  
  // Estados de Chat
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // 1. CARGA INICIAL ROBUSTA
  const fetchProfile = useCallback(async (userId: string, retries = 0) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data) {
        // Si falla, reintentamos hasta 3 veces con un pequeño delay
        if (retries < 3) {
          setTimeout(() => fetchProfile(userId, retries + 1), 1000)
          return
        }
        throw new Error("No se pudo cargar el perfil")
      }

      setProfile(data)
      setLoadingProfile(false)
      fetchCourses(data.role, userId)
    } catch (err) {
      console.error(err)
      setLoadingProfile(false) // Dejamos de cargar para mostrar error
    }
  }, [])

  useEffect(() => {
    setMounted(true)
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)
      fetchProfile(user.id)
    }
    init()
  }, [router, fetchProfile])

  // 2. Fetch Cursos
  const fetchCourses = async (role: string | undefined, userId: string) => {
    if (role === 'teacher') {
      const { data } = await supabase.from('courses').select('*').eq('created_by', userId)
      setMyCourses(data || [])
    } else {
      const { data: enrollmentData } = await supabase
        .from('enrollments')
        .select('course_id, courses(*)')
        .eq('student_id', userId)
      
      const enrolled = enrollmentData?.map((e: any) => e.courses) || []
      setMyCourses(enrolled)

      const { data: allData } = await supabase.from('courses').select('*')
      setCourses(allData || [])
    }
  }

  // 3. Crear Curso
  const createCourse = async () => {
    if (!profile || profile.role !== 'teacher') return
    const { error } = await supabase.from('courses').insert({
      title: newCourseTitle,
      description: newCourseDesc,
      created_by: user.id
    })
    if (!error) {
      setNewCourseTitle('')
      setNewCourseDesc('')
      fetchCourses('teacher', user.id)
      setView('courses')
    }
  }

  // 4. Inscribirse
  const enrollCourse = async (courseId: number) => {
    const { error } = await supabase.from('enrollments').insert({
      student_id: user.id,
      course_id: courseId
    })
    if (!error) {
      fetchCourses('student', user.id)
      alert("¡Te has inscrito correctamente!")
    }
  }

  // 5. Chat Logic
  const handleSendMessage = async () => {
    if (!inputMsg.trim() || !selectedCourse) return

    const newMsg = { role: 'user', content: inputMsg, timestamp: new Date() } as Message
    setMessages(prev => [...prev, newMsg])
    setInputMsg('')
    setAiLoading(true)

    const response = await chatWithGemini(
      newMsg.content, 
      `${selectedCourse.title}: ${selectedCourse.description}`, 
      messages
    )

    if (response.success) {
      setMessages(prev => [...prev, { role: 'model', content: response.message, timestamp: new Date() }])
    }
    setAiLoading(false)
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])


  // --- PANTALLAS DE CARGA Y ERROR ---
  if (!mounted) return null
  
  if (loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-blue-600" />
          </div>
        </div>
        <p className="mt-4 text-gray-500 font-medium animate-pulse">Preparando tu entorno de aprendizaje...</p>
      </div>
    )
  }

  if (!profile && !loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 p-6 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Error cargando perfil</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
          Tu cuenta fue creada pero el perfil tardó en sincronizarse. Por favor, intenta de nuevo.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
        >
          <RefreshCw className="w-5 h-5" /> Recargar Página
        </button>
      </div>
    )
  }

  // --- INTERFAZ PRINCIPAL ---
  return (
    <div className="flex h-screen bg-[#F3F4F6] dark:bg-[#0f172a] transition-colors duration-300 overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-20 lg:w-72 bg-white dark:bg-[#1e293b] border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 z-20 shadow-xl">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/30 shrink-0">
            <GraduationCap className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl text-gray-800 dark:text-white hidden lg:block tracking-tight">EduAI</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <p className="px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 hidden lg:block">Menú</p>
          
          <button 
            onClick={() => setView('courses')} 
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
              view === 'courses' 
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm font-semibold' 
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:translate-x-1'
            }`}
          >
            <BookOpen className="w-5 h-5" /> <span className="hidden lg:block">Mis Cursos</span>
          </button>
          
          {profile!.role === 'student' && (
             <button onClick={() => setView('create')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
              view === 'create' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:translate-x-1'
             }`}>
               <Search className="w-5 h-5" /> <span className="hidden lg:block">Explorar</span>
             </button>
          )}

          {profile!.role === 'teacher' && (
            <button onClick={() => setView('create')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
              view === 'create' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:translate-x-1'
             }`}>
              <Plus className="w-5 h-5" /> <span className="hidden lg:block">Crear Curso</span>
            </button>
          )}

          {selectedCourse && (
            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
               <p className="px-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 hidden lg:block">Activo</p>
               <button onClick={() => setView('chat')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                 view === 'chat' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
               }`}>
                <Bot className="w-5 h-5" /> <span className="hidden lg:block line-clamp-1">{selectedCourse.title}</span>
              </button>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1e293b]/50">
          <div className="flex items-center gap-3 mb-4 p-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors cursor-pointer">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center text-white shadow-md">
              <span className="font-bold text-sm">{profile!.full_name.substring(0,2).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0 hidden lg:block">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{profile!.full_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{profile!.role === 'teacher' ? 'Docente' : 'Estudiante'}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
             <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex-1 flex items-center justify-center p-2 rounded-lg bg-white dark:bg-gray-800 border dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:shadow-md transition-all"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => supabase.auth.signOut().then(() => router.push('/'))} 
              className="flex-1 flex items-center justify-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {/* Header Móvil / Título de Sección */}
        <header className="h-16 bg-white/80 dark:bg-[#1e293b]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-8 z-10">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            {view === 'courses' && <><Book className="w-5 h-5 text-blue-500" /> Mis Cursos</>}
            {view === 'create' && <><Plus className="w-5 h-5 text-green-500" /> {profile!.role === 'teacher' ? 'Nuevo Curso' : 'Explorar'}</>}
            {view === 'chat' && <><Bot className="w-5 h-5 text-indigo-500" /> Tutor IA</>}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          
          {/* VISTA CURSOS */}
          {view === 'courses' && (
            <div className="max-w-7xl mx-auto">
              {myCourses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                  <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-full mb-4">
                    <Book className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">Todo limpio por aquí</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">No tienes cursos activos en este momento.</p>
                  <button onClick={() => setView('create')} className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
                    {profile!.role === 'teacher' ? 'Crear mi primer curso' : 'Buscar cursos'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myCourses.map((course) => (
                    <div key={course.id} className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                      <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 relative p-6 flex flex-col justify-end">
                         <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md p-1.5 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                           <MoreVertical className="w-5 h-5" />
                         </div>
                         <h3 className="font-bold text-xl text-white tracking-wide shadow-sm">{course.title}</h3>
                      </div>
                      <div className="p-6 flex-1 flex flex-col">
                        <p className="text-gray-600 dark:text-gray-300 text-sm mb-6 line-clamp-3 leading-relaxed flex-1">
                          {course.description}
                        </p>
                        <button 
                          onClick={() => {
                            setSelectedCourse(course)
                            setView('chat')
                            setMessages([])
                          }}
                          className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-white group-hover:bg-blue-600 group-hover:text-white transition-all"
                        >
                          <Bot className="w-4 h-4" /> Entrar al Aula
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VISTA CREAR / EXPLORAR */}
          {view === 'create' && (
             <div className="max-w-4xl mx-auto">
                {profile!.role === 'teacher' ? (
                  <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <div className="mb-8 border-b dark:border-gray-700 pb-4">
                      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Crear Nuevo Curso</h2>
                      <p className="text-gray-500 dark:text-gray-400">Diseña el contenido para tus estudiantes</p>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Título del Curso</label>
                        <input 
                           className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                           value={newCourseTitle}
                           onChange={e => setNewCourseTitle(e.target.value)}
                           placeholder="Ej: Matemáticas Avanzadas"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Descripción Detallada</label>
                        <textarea 
                           className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl h-40 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white resize-none"
                           value={newCourseDesc}
                           onChange={e => setNewCourseDesc(e.target.value)}
                           placeholder="Describe los objetivos y temas del curso..."
                        />
                      </div>
                      <div className="flex justify-end pt-4">
                         <button onClick={createCourse} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all hover:scale-105">
                           Publicar Curso
                         </button>
                      </div>
                    </div>
                  </div>
                ) : (
                   <div>
                      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Explorar Catálogo</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {courses.map(course => (
                          <div key={course.id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                               <h3 className="font-bold text-lg text-gray-800 dark:text-white">{course.title}</h3>
                               <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs px-2 py-1 rounded-md font-bold">Curso</span>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 flex-1">{course.description}</p>
                            
                            {myCourses.find(c => c.id === course.id) ? (
                              <button disabled className="w-full py-2.5 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl font-semibold text-sm cursor-default border border-green-200 dark:border-green-800/30">
                                ✓ Ya estás inscrito
                              </button>
                            ) : (
                              <button onClick={() => enrollCourse(course.id)} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/20 transition-all">
                                Inscribirse Ahora
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                   </div>
                )}
             </div>
          )}

          {/* VISTA CHAT (ESTILO BUBBLES) */}
          {view === 'chat' && selectedCourse && (
            <div className="h-[calc(100vh-140px)] flex flex-col bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              {/* Chat Header */}
              <div className="p-4 bg-indigo-600 flex items-center gap-4 shadow-md z-10">
                 <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                   <Bot className="text-white w-6 h-6" />
                 </div>
                 <div>
                   <h3 className="font-bold text-white text-lg leading-none">{selectedCourse.title}</h3>
                   <span className="text-indigo-200 text-xs flex items-center gap-1">
                     <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> IA Conectada
                   </span>
                 </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 dark:bg-[#0b1120] relative">
                {/* Fondo decorativo opcional */}
                <div className="absolute inset-0 opacity-5 dark:opacity-5 pointer-events-none" style={{backgroundImage: "radial-gradient(#6366f1 1px, transparent 1px)", backgroundSize: "20px 20px"}}></div>

                 {messages.length === 0 && (
                   <div className="text-center py-20 opacity-60">
                     <div className="bg-indigo-100 dark:bg-indigo-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Bot className="w-10 h-10 text-indigo-500" />
                     </div>
                     <p className="text-gray-500 dark:text-gray-400 font-medium">Inicia la conversación</p>
                     <p className="text-xs text-gray-400">Pregunta dudas o pide ejercicios prácticos</p>
                   </div>
                 )}

                 {messages.map((msg, i) => (
                   <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                     <div className={`flex items-end gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                       
                       {/* Avatar Pequeño */}
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                         msg.role === 'user' ? 'bg-blue-500' : 'bg-indigo-600'
                       }`}>
                         {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                       </div>

                       {/* Burbuja */}
                       <div className={`p-4 rounded-2xl shadow-sm relative ${
                         msg.role === 'user' 
                           ? 'bg-blue-600 text-white rounded-br-none' 
                           : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none border border-gray-100 dark:border-gray-600'
                       }`}>
                         <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                         <span className={`text-[10px] mt-1 block opacity-70 ${msg.role === 'user' ? 'text-blue-100 text-left' : 'text-gray-400 text-right'}`}>
                           {msg.timestamp ? msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Ahora'}
                         </span>
                       </div>
                     </div>
                   </div>
                 ))}

                 {aiLoading && (
                   <div className="flex justify-start">
                     <div className="bg-white dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-none border dark:border-gray-600 shadow-sm flex gap-2 items-center ml-10">
                       <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                       <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75" />
                       <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150" />
                     </div>
                   </div>
                 )}
                 <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-3 items-end bg-gray-50 dark:bg-gray-900 p-2 rounded-3xl border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                  <input 
                    className="flex-1 bg-transparent px-4 py-3 max-h-32 outline-none text-gray-800 dark:text-white placeholder-gray-400 resize-none"
                    placeholder="Escribe tu mensaje aquí..."
                    value={inputMsg}
                    onChange={e => setInputMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                    disabled={aiLoading}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={aiLoading || !inputMsg.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all hover:scale-105 active:scale-95 mb-1 mr-1"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}