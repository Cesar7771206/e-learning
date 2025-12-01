'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { chatWithGemini } from '../actions'
import { 
  LogOut, Plus, Book, User, Send, Bot, 
  GraduationCap, Sun, Moon, 
  Search, AlertCircle, RefreshCw, Wrench,
  Calendar as CalendarIcon, Lightbulb, Code as CodeIcon,
  Play, Video, ExternalLink, Trash2, Edit, Users, ListChecks, FileText
} from 'lucide-react'
import { useTheme } from 'next-themes'

// --- TIPOS Y UTILIDADES ---
type Profile = { id: string, role: 'student' | 'teacher', full_name: string, avatar_url?: string }
type CourseCategory = 'math' | 'programming' | 'letters' | 'other'

type Course = { 
  id: number, 
  title: string, 
  description: string, 
  category: CourseCategory,
  created_by: string,
  syllabus?: string, // Nuevo campo
  profiles?: { full_name: string }
}

type Session = {
  id: string,
  course_id: number,
  date: string,
  time: string,
  link: string
}

type Message = { 
  id?: string,
  role: 'user' | 'model', 
  content: string, 
  timestamp?: Date,
  options?: string[], 
  isCodeRequest?: boolean 
}

// Utilidad simple para resaltar sintaxis (simulada)
const highlightCode = (code: string) => {
  return code
    .replace(/\b(function|const|let|var|if|else|return|import|from|class|export|async|await)\b/g, '<span class="text-purple-400 font-bold">$1</span>')
    .replace(/\b(console|log|map|filter|reduce|push)\b/g, '<span class="text-blue-400">$1</span>')
    .replace(/('.*?'|".*?")/g, '<span class="text-green-400">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="text-orange-400">$1</span>')
    .replace(/(\/\/.*)/g, '<span class="text-gray-500 italic">$1</span>');
}

export default function Dashboard() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Estados Globales
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  
  // Vistas y Datos
  const [view, setView] = useState<'courses' | 'course_detail' | 'create'>('courses')
  const [courses, setCourses] = useState<Course[]>([])
  const [myCourses, setMyCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [courseSessions, setCourseSessions] = useState<Session[]>([])
  const [enrolledStudents, setEnrolledStudents] = useState<Profile[]>([]) // Lista de estudiantes
  
  // Formularios
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [newCourseDesc, setNewCourseDesc] = useState('')
  const [newCourseCategory, setNewCourseCategory] = useState<CourseCategory>('other')
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null)
  const [syllabusInput, setSyllabusInput] = useState('') // Estado para el sílabo

  // Chat y Editor
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [codeEditorVisible, setCodeEditorVisible] = useState(false)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionData, setSessionData] = useState({ date: '', time: '', link: '' })
  
  const chatEndRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  // --- 1. INICIALIZACIÓN ---
  const fetchProfile = useCallback(async (currentUser: any) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle()
      if (error) throw error
      if (!data) {
        // Autocuración simple
        await supabase.from('profiles').insert({
          id: currentUser.id, full_name: currentUser.email?.split('@')[0], role: 'student'
        })
        window.location.reload()
        return
      }
      setProfile(data)
      setLoadingProfile(false)
      fetchCourses(data.role, currentUser.id)
    } catch (err) { console.error(err); setLoadingProfile(false) }
  }, [])

  useEffect(() => {
    setMounted(true)
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/')
      else { setUser(data.user); fetchProfile(data.user); }
    })
  }, [router, fetchProfile])

  // --- 2. GESTIÓN DE DATOS ---
  const fetchCourses = async (role: string | undefined, userId: string) => {
    if (role === 'teacher') {
      let { data } = await supabase.from('courses').select('*, profiles(full_name)').eq('created_by', userId)
      if (!data) { const res = await supabase.from('courses').select('*').eq('created_by', userId); data = res.data }
      setMyCourses(data || [])
    } else {
      let { data } = await supabase.from('enrollments').select('course_id, courses(*, profiles(full_name))').eq('student_id', userId)
      if (!data) { const res = await supabase.from('enrollments').select('course_id, courses(*)').eq('student_id', userId); data = res.data }
      setMyCourses(data?.map((e: any) => e.courses).filter(Boolean) || [])
      
      const all = await supabase.from('courses').select('*, profiles(full_name)')
      setCourses(all.data || [])
    }
  }

  const fetchEnrolledStudents = async (courseId: number) => {
    const { data } = await supabase
      .from('enrollments')
      .select('student_id, profiles(*)')
      .eq('course_id', courseId)
    setEnrolledStudents(data?.map((e: any) => e.profiles) || [])
  }

  // --- 3. ACCIONES DOCENTE ---
  const generateSyllabus = async () => {
    if (!selectedCourse) return
    const prompt = `Genera un sílabo detallado de 5 temas clave para un curso de "${selectedCourse.title}" (${selectedCourse.category}). Solo devuelve la lista numerada.`
    alert("Generando sílabo con IA...")
    const res = await chatWithGemini(prompt, "Experto Curricular", [])
    if (res.success) setSyllabusInput(res.message)
  }

  const saveSyllabus = async () => {
    if (!selectedCourse) return
    const { error } = await supabase.from('courses').update({ syllabus: syllabusInput }).eq('id', selectedCourse.id)
    if (!error) {
      alert("Sílabo actualizado")
      // Actualizar estado local
      setSelectedCourse({ ...selectedCourse, syllabus: syllabusInput })
    }
  }

  const createOrUpdateCourse = async () => {
    if (!profile || profile.role !== 'teacher') return
    try {
      const payload = { title: newCourseTitle, description: newCourseDesc, category: newCourseCategory }
      if (editingCourseId) {
        await supabase.from('courses').update(payload).eq('id', editingCourseId)
      } else {
        await supabase.from('courses').insert({ ...payload, created_by: user.id })
      }
      setNewCourseTitle(''); setNewCourseDesc(''); setEditingCourseId(null);
      setTimeout(() => { fetchCourses('teacher', user.id); setView('courses') }, 500)
    } catch (e: any) { alert(e.message) }
  }

  // --- 4. CHAT LÓGICA ---
  const getSystemPrompt = (course: Course) => {
    const syllabusContext = course.syllabus ? `SÍLABO DEL CURSO: \n${course.syllabus}\n Basa tus preguntas y evaluación en estos temas.` : "Define temas relevantes."
    
    let role = "Tutor Experto."
    if (course.category === 'math') role = "Profesor de Matemáticas. Usa LaTeX ($$) para fórmulas. Sé visual."
    if (course.category === 'programming') role = "Senior Developer. Si pides código, termina tu mensaje con {{CODE_REQUEST}}. Evalúa lógica y sintaxis."
    if (course.category === 'letters') role = "Profesor de Letras. Usa lenguaje elegante, estructura en párrafos claros y evita símbolos markdown como **."

    return `
      CONTEXTO: ${course.title}. ${syllabusContext}
      ROL: ${role}
      REGLA 1: Si haces una pregunta de opción múltiple, pon al final: {{Opción A|Opción B}}
      REGLA 2: Si el curso es "Otro" o "Letras", NO uses asteriscos dobles (**) para negritas, usa etiquetas HTML simples <b> o simplemente escribe limpio.
      REGLA 3: Si muestras código de ejemplo, enciérralo en triple backtick.
    `
  }

  const handleSendMessage = async (msgOverride?: string) => {
    const txt = msgOverride || inputMsg
    if (!txt.trim() || !selectedCourse) return

    const userMsg: Message = { role: 'user', content: txt, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInputMsg('')
    setAiLoading(true)
    setCodeEditorVisible(false)

    // Guardar en DB
    await supabase.from('chat_messages').insert({
      user_id: user.id, course_id: selectedCourse.id, role: 'user', content: txt
    })

    const res = await chatWithGemini(txt, getSystemPrompt(selectedCourse), messages)
    
    if (res.success) {
      const { text, options, isCodeRequest } = parseAiResponse(res.message)
      const aiMsg: Message = { role: 'model', content: text, timestamp: new Date(), options, isCodeRequest }
      setMessages(prev => [...prev, aiMsg])
      await supabase.from('chat_messages').insert({
        user_id: user.id, course_id: selectedCourse.id, role: 'model', content: text,
        options: options ? JSON.stringify(options) : null, is_code_request: isCodeRequest
      })
      if (isCodeRequest) setCodeEditorVisible(true)
    }
    setAiLoading(false)
  }

  const parseAiResponse = (text: string) => {
    let cleanText = text
    let options: string[] | undefined = undefined
    let isCodeRequest = false
    const match = text.match(/\{\{(.+?)\}\}/)
    if (match) {
      if (match[1].includes('CODE_REQUEST')) isCodeRequest = true
      else options = match[1].split('|')
      cleanText = text.replace(match[0], '').trim()
    }
    return { text: cleanText, options, isCodeRequest }
  }

  // --- 5. RENDERIZADO DE TEXTO (PARSER DE ESTILOS) ---
  const renderRichText = (text: string, category: CourseCategory) => {
    // Paso 1: Separar bloques de código (```code```)
    const blocks = text.split(/(```[\s\S]*?```)/g)
    
    return blocks.map((block, i) => {
      if (block.startsWith('```') && block.endsWith('```')) {
        // Renderizar bloque de código con estilo
        const codeContent = block.slice(3, -3).replace(/^.*\n/, '') // Quitar primera línea (lenguaje)
        return (
          <div key={i} className="my-3 rounded-lg overflow-hidden border border-gray-700 bg-[#1e1e1e] shadow-lg">
            <div className="bg-[#2d2d2d] px-3 py-1 text-xs text-gray-400 flex items-center gap-1">
              <CodeIcon className="w-3 h-3"/> Ejemplo de Código
            </div>
            <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-200"
                 dangerouslySetInnerHTML={{ __html: highlightCode(codeContent) }} />
          </div>
        )
      }
      
      // Renderizar texto normal con formato (Negritas, Formulas)
      let formatted = block
      // Formulas Matematicas
      if (category === 'math') {
        formatted = formatted.replace(/\$\$(.*?)\$\$/g, '<div class="my-2 p-2 bg-blue-50 dark:bg-blue-900/20 text-center font-serif text-lg rounded border border-blue-100 dark:border-blue-800">$1</div>')
        formatted = formatted.replace(/\$(.*?)\$/g, '<span class="font-serif italic bg-gray-100 dark:bg-gray-800 px-1 rounded">$1</span>')
      }
      
      // Limpieza Markdown (Bold, Lists)
      formatted = formatted
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-indigo-600 dark:text-indigo-400 font-bold">$1</strong>')
        .replace(/^\* (.*$)/gm, '<li class="ml-4 list-disc marker:text-indigo-500">$1</li>')
        .replace(/\n/g, '<br/>')

      return <span key={i} dangerouslySetInnerHTML={{ __html: formatted }} className={category === 'letters' ? 'font-serif text-lg leading-relaxed text-gray-800 dark:text-gray-200' : ''} />
    })
  }

  // --- 6. EDITOR DE CÓDIGO (ESTUDIANTE) ---
  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      target.setRangeText('  ', target.selectionStart, target.selectionStart, 'end');
    }
    const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']', '"': '"', "'": "'" };
    if (pairs[e.key]) {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      target.setRangeText(e.key + pairs[e.key], target.selectionStart, target.selectionEnd, 'end');
      target.selectionStart = target.selectionEnd - 1;
      target.selectionEnd = target.selectionEnd - 1;
    }
  }

  // --- 7. RENDER ---
  if (!mounted) return null
  if (loadingProfile) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><RefreshCw className="animate-spin text-blue-600 w-8 h-8"/></div>

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#020617] transition-colors duration-300 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-20 lg:w-72 bg-white dark:bg-[#0f172a] border-r border-gray-200 dark:border-gray-800 flex flex-col z-20 shadow-xl">
        <div className="p-6 flex items-center gap-3 border-b dark:border-gray-800">
          <div className="bg-indigo-600 p-2 rounded-xl text-white"><GraduationCap /></div>
          <span className="font-bold text-xl dark:text-white hidden lg:block">E-Learning</span>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => { setView('courses'); if (user && profile) fetchCourses(profile.role, user.id); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'courses' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            <Book className="w-5 h-5" /> <span className="hidden lg:block">Mis Cursos</span>
          </button>
          <button onClick={() => { setView('create'); setEditingCourseId(null); setNewCourseTitle(''); setNewCourseDesc(''); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'create' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            {profile?.role === 'teacher' ? <Plus className="w-5 h-5" /> : <Search className="w-5 h-5" />} 
            <span className="hidden lg:block">{profile?.role === 'teacher' ? 'Crear Curso' : 'Explorar'}</span>
          </button>
        </nav>
        <div className="p-4 border-t dark:border-gray-800 flex gap-2">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 flex justify-center"><Sun className="w-5 h-5 hidden dark:block"/><Moon className="w-5 h-5 block dark:hidden"/></button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="flex-1 p-2 rounded-lg bg-red-50 text-red-500 flex justify-center"><LogOut className="w-5 h-5"/></button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* LISTA DE CURSOS */}
        {view === 'courses' && (
          <div className="flex-1 overflow-y-auto p-8">
            <h1 className="text-2xl font-bold dark:text-white mb-6">Mis Cursos</h1>
            {myCourses.length === 0 ? <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-500">No tienes cursos.</div> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myCourses.map(course => (
                  <div key={course.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all group">
                    <div className={`h-32 p-6 flex flex-col justify-end relative ${course.category === 'math' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : course.category === 'programming' ? 'bg-gradient-to-r from-slate-700 to-slate-900' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`}>
                       <span className="absolute top-4 right-4 bg-white/20 text-white text-xs px-2 py-1 rounded backdrop-blur-sm uppercase font-bold">{course.category}</span>
                       <h3 className="text-white font-bold text-xl">{course.title}</h3>
                    </div>
                    <div className="p-6">
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">{course.description}</p>
                      <div className="flex gap-2">
                        {profile?.role === 'teacher' ? (
                          <button onClick={() => { setSelectedCourse(course); setSyllabusInput(course.syllabus || ''); fetchEnrolledStudents(course.id); setView('course_detail'); }} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 text-sm">Gestionar</button>
                        ) : (
                          <button onClick={() => { setSelectedCourse(course); setView('course_detail'); setMessages([]); fetchEnrolledStudents(course.id) }} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 text-sm">Entrar</button>
                        )}
                        {profile?.role === 'teacher' && <button onClick={() => { setEditingCourseId(course.id); setNewCourseTitle(course.title); setNewCourseDesc(course.description); setView('create'); }} className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><Edit className="w-4 h-4"/></button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DETALLE CURSO (AULA VIRTUAL O GESTIÓN) */}
        {view === 'course_detail' && selectedCourse && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* IZQUIERDA: CONTENIDO PRINCIPAL */}
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#0b1120] relative">
               <div className="h-16 bg-white dark:bg-gray-900 border-b dark:border-gray-800 flex items-center justify-between px-6 shrink-0">
                 <div className="flex items-center gap-3">
                   <button onClick={() => setView('courses')} className="text-gray-400 hover:text-gray-600">← Volver</button>
                   <h2 className="font-bold dark:text-white">{selectedCourse.title} <span className="text-xs text-gray-500 font-normal ml-2">{profile?.role === 'teacher' ? '(Gestión)' : '(Aula)'}</span></h2>
                 </div>
               </div>

               {profile?.role === 'teacher' ? (
                 // --- VISTA DOCENTE: GESTIÓN Y SÍLABO ---
                 <div className="flex-1 p-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {/* Columna 1: Estudiantes */}
                   <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border dark:border-gray-700 h-fit">
                     <h3 className="font-bold text-lg mb-4 flex items-center gap-2 dark:text-white"><Users className="w-5 h-5 text-indigo-500"/> Estudiantes Inscritos ({enrolledStudents.length})</h3>
                     {enrolledStudents.length === 0 ? <p className="text-gray-400 text-sm">Aún no hay inscritos.</p> : (
                       <ul className="space-y-3">
                         {enrolledStudents.map(st => (
                           <li key={st.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                             <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">{st.full_name[0]}</div>
                             <span className="text-sm dark:text-gray-200">{st.full_name}</span>
                           </li>
                         ))}
                       </ul>
                     )}
                   </div>

                   {/* Columna 2: Sílabo */}
                   <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border dark:border-gray-700 h-full flex flex-col">
                     <div className="flex justify-between items-center mb-4">
                       <h3 className="font-bold text-lg flex items-center gap-2 dark:text-white"><ListChecks className="w-5 h-5 text-green-500"/> Sílabo del Curso</h3>
                       <button onClick={generateSyllabus} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold hover:bg-green-200 flex items-center gap-1"><Lightbulb className="w-3 h-3"/> Generar con IA</button>
                     </div>
                     <textarea 
                        className="flex-1 w-full bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-xl p-4 text-sm font-mono leading-relaxed resize-none focus:ring-2 focus:ring-green-500 outline-none dark:text-gray-200"
                        placeholder="1. Introducción..."
                        value={syllabusInput}
                        onChange={e => setSyllabusInput(e.target.value)}
                     />
                     <button onClick={saveSyllabus} className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-xl font-bold hover:bg-indigo-700">Guardar Sílabo</button>
                   </div>
                 </div>
               ) : (
                 // --- VISTA ESTUDIANTE: CHAT MEJORADO ---
                 <>
                   <div className="flex-1 overflow-y-auto p-6 space-y-6">
                     {messages.length === 0 && (
                       <div className="text-center py-20 opacity-60">
                         <Bot className="w-16 h-16 mx-auto mb-4 text-indigo-300"/>
                         <p className="dark:text-white">¡Hola! Estoy listo para enseñarte sobre {selectedCourse.title}.</p>
                         <button onClick={() => handleSendMessage("Hola, inicia la clase.")} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-full font-bold hover:bg-indigo-700">Comenzar Clase</button>
                       </div>
                     )}
                     {messages.map((msg, i) => (
                       <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-3xl mx-auto w-full animate-in slide-in-from-bottom-2`}>
                         <div className={`flex gap-3 max-w-[95%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-green-600'}`}>{msg.role === 'user' ? <User className="text-white w-4 h-4"/> : <Bot className="text-white w-4 h-4"/>}</div>
                           <div className="flex flex-col gap-2 w-full">
                             <div className={`p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 dark:text-gray-100 rounded-tl-none border dark:border-gray-700'}`}>
                               <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.role === 'model' ? renderRichText(msg.content, selectedCourse.category) : msg.content}</div>
                             </div>
                             {msg.options && (
                               <div className="flex flex-wrap gap-2 mt-1">
                                 {msg.options.map((opt, idx) => (
                                   <button key={idx} onClick={() => handleSendMessage(opt)} className="bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-indigo-900/30 px-4 py-2 rounded-xl text-sm hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all font-medium dark:text-gray-300">
                                     {opt}
                                   </button>
                                 ))}
                               </div>
                             )}
                             {msg.isCodeRequest && (
                               <div className="w-full bg-[#1e1e1e] rounded-xl overflow-hidden shadow-lg border border-gray-700 mt-2">
                                 <div className="bg-[#252526] px-4 py-2 flex items-center justify-between border-b border-[#333]">
                                   <span className="text-gray-400 text-xs flex items-center gap-2"><CodeIcon className="w-3 h-3 text-blue-400" /> Editor de Estudiante</span>
                                   <div className="flex gap-1"><div className="w-3 h-3 rounded-full bg-red-500"/><div className="w-3 h-3 rounded-full bg-yellow-500"/><div className="w-3 h-3 rounded-full bg-green-500"/></div>
                                 </div>
                                 <textarea 
                                   ref={editorRef}
                                   disabled={!codeEditorVisible && i !== messages.length - 1}
                                   onKeyDown={handleCodeKeyDown}
                                   className="w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 h-64 outline-none resize-none selection:bg-blue-500/30"
                                   placeholder="// Escribe tu solución aquí..."
                                   value={inputMsg}
                                   onChange={(e) => setInputMsg(e.target.value)}
                                   spellCheck={false}
                                 />
                                 {codeEditorVisible && i === messages.length - 1 && (<div className="p-3 bg-[#252526] flex justify-end border-t border-[#333]"><button onClick={() => handleSendMessage()} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 uppercase tracking-wide"><Play className="w-3 h-3" /> Ejecutar Código</button></div>)}
                               </div>
                             )}
                           </div>
                         </div>
                       </div>
                     ))}
                     <div ref={chatEndRef} />
                   </div>
                   {!codeEditorVisible && (
                     <div className="p-4 bg-white dark:bg-gray-900 border-t dark:border-gray-800 max-w-3xl mx-auto w-full">
                       <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-full border dark:border-gray-700 focus-within:ring-2 focus-within:ring-indigo-500 shadow-inner">
                         <input className="flex-1 bg-transparent px-4 py-2 outline-none dark:text-white" placeholder="Escribe tu respuesta..." value={inputMsg} onChange={e => setInputMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} disabled={aiLoading}/>
                         <button onClick={() => handleSendMessage()} disabled={!inputMsg.trim()} className="p-2 bg-indigo-600 rounded-full text-white hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 active:scale-95"><Send className="w-4 h-4"/></button>
                       </div>
                     </div>
                   )}
                 </>
               )}
            </div>

            {/* DERECHA: ASESORÍAS */}
            <div className="w-full md:w-72 bg-white dark:bg-[#0f172a] border-l dark:border-gray-800 overflow-y-auto p-6 shrink-0">
               <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2"><Video className="w-5 h-5 text-purple-500"/> Asesorías</h3>
               {profile?.role === 'teacher' && selectedCourse.created_by === user?.id && (
                 <button onClick={() => setShowSessionForm(!showSessionForm)} className="w-full mb-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 text-xs font-bold hover:border-purple-500 hover:text-purple-500 uppercase tracking-wide flex items-center justify-center gap-2 transition-all"><Plus className="w-4 h-4"/> Nueva Sesión</button>
               )}
               {showSessionForm && (
                 <div className="mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border dark:border-gray-700 space-y-2">
                   <input type="date" className="w-full p-2 text-xs rounded border dark:bg-gray-900 dark:border-gray-600" onChange={e => setSessionData({...sessionData, date: e.target.value})}/>
                   <input type="time" className="w-full p-2 text-xs rounded border dark:bg-gray-900 dark:border-gray-600" onChange={e => setSessionData({...sessionData, time: e.target.value})}/>
                   <input type="url" placeholder="Link Meet/Zoom" className="w-full p-2 text-xs rounded border dark:bg-gray-900 dark:border-gray-600" onChange={e => setSessionData({...sessionData, link: e.target.value})}/>
                   <button className="w-full bg-purple-600 text-white py-1 rounded text-xs font-bold" onClick={async () => {
                     await supabase.from('sessions').insert({ course_id: selectedCourse.id, ...sessionData })
                     setShowSessionForm(false); alert("Creada")
                   }}>Confirmar</button>
                 </div>
               )}
               {/* Lista de Sesiones (Aquí iría el fetch real, simulado visualmente) */}
               <div className="space-y-2">
                 <div className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800">
                   <p className="text-xs font-bold text-purple-700 dark:text-purple-300">Sesión de Repaso</p>
                   <p className="text-[10px] text-gray-500">Mañana, 10:00 AM</p>
                   <button className="mt-2 text-xs bg-white dark:bg-gray-800 border px-2 py-1 rounded flex items-center gap-1 w-full justify-center hover:bg-purple-50 dark:hover:bg-purple-900/30"><ExternalLink className="w-3 h-3"/> Unirse</button>
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* VISTA: CREAR CURSO */}
        {view === 'create' && (
          <div className="flex-1 overflow-y-auto p-8 flex justify-center">
             <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 h-fit">
               <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold dark:text-white">{profile?.role === 'teacher' ? (editingCourseId ? 'Editar Curso' : 'Crear Curso') : 'Explorar'}</h2><button onClick={() => setView('courses')} className="text-gray-400 hover:text-gray-600">Cancelar</button></div>
               {profile?.role === 'teacher' ? (
                 <div className="space-y-5">
                   <div><label className="block text-sm font-bold mb-2 dark:text-gray-300">Título</label><input className="w-full p-3 border rounded-xl dark:bg-gray-900 dark:border-gray-700 dark:text-white" placeholder="Ej: Intro a React" value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} /></div>
                   <div className="grid grid-cols-3 gap-3">
                     {['math', 'letters', 'programming'].map(cat => (
                       <button key={cat} onClick={() => setNewCourseCategory(cat as any)} className={`p-3 rounded-xl border text-sm font-bold capitalize transition-all ${newCourseCategory === cat ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}`}>{cat === 'math' ? '📐 Mate' : cat === 'letters' ? '📚 Letras' : '💻 Code'}</button>
                     ))}
                   </div>
                   <div><label className="block text-sm font-bold mb-2 dark:text-gray-300">Descripción</label><textarea className="w-full p-3 border rounded-xl h-32 dark:bg-gray-900 dark:border-gray-700 dark:text-white" value={newCourseDesc} onChange={e => setNewCourseDesc(e.target.value)} /></div>
                   <button onClick={createOrUpdateCourse} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg">{editingCourseId ? 'Guardar Cambios' : 'Publicar'}</button>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {courses.map(c => (
                     <div key={c.id} className="border dark:border-gray-700 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                       <h3 className="font-bold dark:text-white">{c.title}</h3>
                       <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-4 line-clamp-2">{c.description}</p>
                       {myCourses.some(mc => mc.id === c.id) ? <button disabled className="w-full py-2 bg-green-100 text-green-700 rounded-lg text-sm font-bold">Inscrito</button> : <button onClick={async () => { await supabase.from('enrollments').insert({ student_id: user.id, course_id: c.id }); fetchCourses('student', user.id); alert('Inscrito') }} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Inscribirse</button>}
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        )}
      </main>
    </div>
  )
}