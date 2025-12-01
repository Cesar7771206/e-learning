'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { chatWithGemini } from '../actions'
import { 
  LogOut, Plus, Book, User, Send, Bot, 
  GraduationCap, Sun, Moon, Search, RefreshCw, 
  Calendar as CalendarIcon, Lightbulb, Code as CodeIcon,
  Play, Video, ExternalLink, Trash2, Edit, Users, ListChecks, ArrowLeft, Terminal, X, GripVertical, Check
} from 'lucide-react'
import { useTheme } from 'next-themes'

// --- TIPOS ---
type Profile = { id: string, role: 'student' | 'teacher', full_name: string, avatar_url?: string }
type CourseCategory = 'math' | 'programming' | 'letters' | 'other'

type Course = { 
  id: number, 
  title: string, 
  description: string, 
  category: CourseCategory,
  created_by: string,
  syllabus?: string, // Ahora guardaremos un JSON string aquí
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

// Utilidad para resaltar código
const highlightCode = (code: string) => {
  if (!code) return '';
  let html = code
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\b(function|const|let|var|if|else|return|import|from|class|export|async|await|def|for|while|try|catch)\b/g, '<span class="text-[#c678dd] font-bold">$1</span>')
    .replace(/\b(console|log|map|filter|reduce|push|print|len|range)\b/g, '<span class="text-[#61afef]">$1</span>')
    .replace(/('.*?'|".*?"|`.*?`)/g, '<span class="text-[#98c379]">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="text-[#d19a66]">$1</span>')
    .replace(/(\/\/.*$|#.*$)/gm, '<span class="text-[#5c6370] italic">$1</span>');
  return html;
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
  const [enrolledStudents, setEnrolledStudents] = useState<Profile[]>([]) 
  
  // Formularios Curso
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [newCourseDesc, setNewCourseDesc] = useState('')
  const [newCourseCategory, setNewCourseCategory] = useState<CourseCategory>('other')
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null)
  
  // Estado para el Sílabo por Bloques
  const [syllabusItems, setSyllabusItems] = useState<string[]>([])

  // Chat y Editor
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [codeEditorVisible, setCodeEditorVisible] = useState(false)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionData, setSessionData] = useState({ date: '', time: '', link: '' })
  
  const chatEndRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  // --- 1. CARGA INICIAL ---
  const fetchProfile = useCallback(async (currentUser: any) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle()
      if (!data || error) {
        // Autocuración
        await supabase.from('profiles').upsert({
          id: currentUser.id, full_name: currentUser.email?.split('@')[0] || 'Usuario', role: 'student'
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
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) router.push('/')
      else { setUser(data.user); fetchProfile(data.user); }
    }
    init()
  }, [router, fetchProfile])

  // --- 2. GESTIÓN DE DATOS ---
  const fetchCourses = async (role: string | undefined, userId: string) => {
    try {
      if (role === 'teacher') {
        const { data: complexData, error } = await supabase.from('courses').select('*, profiles(full_name)').eq('created_by', userId)
        if (error || !complexData) {
           const { data: simpleData } = await supabase.from('courses').select('*').eq('created_by', userId)
           setMyCourses(simpleData || [])
        } else {
           setMyCourses(complexData)
        }
      } else {
        // Estudiante
        const { data: enrollData } = await supabase.from('enrollments').select('course_id, courses(*, profiles(full_name))').eq('student_id', userId)
        const enrolled = enrollData?.map((e: any) => e.courses).filter(Boolean) || []
        setMyCourses(enrolled)
        
        const { data: allData } = await supabase.from('courses').select('*, profiles(full_name)')
        setCourses(allData || [])
      }
    } catch (e) { console.error(e) }
  }

  // Fetch de estudiantes ROBUSTO (separado para evitar errores de join)
  const fetchEnrolledStudents = async (courseId: number) => {
    try {
      // 1. Obtener IDs de estudiantes
      const { data: enrollments, error } = await supabase.from('enrollments').select('student_id').eq('course_id', courseId)
      
      if (error || !enrollments || enrollments.length === 0) {
        setEnrolledStudents([])
        return
      }

      const studentIds = enrollments.map(e => e.student_id)

      // 2. Obtener perfiles reales
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', studentIds)
      setEnrolledStudents(profiles || [])
    } catch (e) {
      console.error("Error fetching students:", e)
      setEnrolledStudents([])
    }
  }

  const fetchSessions = async (courseId: number) => {
    const { data } = await supabase.from('sessions').select('*').eq('course_id', courseId).order('date', { ascending: true })
    setCourseSessions(data || [])
  }

  // --- 3. CHAT E HISTORIAL ---
  const fetchChatHistory = async (courseId: number) => {
    if (!user) return
    setAiLoading(true)
    const { data } = await supabase.from('chat_messages').select('*').eq('course_id', courseId).eq('user_id', user.id).order('created_at', { ascending: true })
    
    if (data && data.length > 0) {
      setMessages(data.map(m => ({
        id: m.id, role: m.role as 'user' | 'model', content: m.content, timestamp: new Date(m.created_at),
        options: m.options ? JSON.parse(m.options as any) : undefined, isCodeRequest: m.is_code_request
      })))
      if (data[data.length - 1].is_code_request) setCodeEditorVisible(true)
    } else {
      setMessages([])
    }
    setAiLoading(false)
  }

  const initAiConversation = async (course: Course) => {
    const sysPrompt = getSystemPrompt(course)
    const res = await chatWithGemini("Hola, soy el estudiante. Inicia la clase saludando y hazme una pregunta del primer tema del sílabo.", sysPrompt, [])
    if (res.success) processAiResponse(res.message, course.id)
  }

  const handleSendMessage = async (msgOverride?: string) => {
    const txt = msgOverride || inputMsg
    if (!txt.trim() || !selectedCourse) return

    const userMsg: Message = { role: 'user', content: txt, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInputMsg('')
    setAiLoading(true)
    setCodeEditorVisible(false) 

    await supabase.from('chat_messages').insert({ user_id: user.id, course_id: selectedCourse.id, role: 'user', content: txt })

    const sysPrompt = getSystemPrompt(selectedCourse)
    const res = await chatWithGemini(txt, sysPrompt, messages)
    
    if (res.success) processAiResponse(res.message, selectedCourse.id)
    setAiLoading(false)
  }

  const processAiResponse = async (textRaw: string, courseId: number) => {
    const { text, options, isCodeRequest } = parseAiResponse(textRaw)
    const aiMsg: Message = { role: 'model', content: text, timestamp: new Date(), options, isCodeRequest }
    
    setMessages(prev => [...prev, aiMsg])
    await supabase.from('chat_messages').insert({ 
      user_id: user.id, course_id: courseId, role: 'model', content: text, 
      options: options ? JSON.stringify(options) : null, is_code_request: isCodeRequest 
    })

    if (isCodeRequest) setCodeEditorVisible(true)
  }

  const getSystemPrompt = (course: Course) => {
    // Parseamos el sílabo si es JSON, sino usamos el texto plano antiguo
    let syllabusList = "Temas generales."
    try {
      if (course.syllabus) {
        const parsed = JSON.parse(course.syllabus)
        if (Array.isArray(parsed)) syllabusList = parsed.join(", ")
        else syllabusList = course.syllabus
      }
    } catch { syllabusList = course.syllabus || "" }

    const syllabusPrompt = `TEMARIO OBLIGATORIO: [${syllabusList}]. (Sigue estrictamente este orden de temas).`
    
    let roleInstructions = "Eres un tutor experto."
    if (course.category === 'math') roleInstructions = "Eres Profesor de Matemáticas. Usa LaTeX ($$) para fórmulas. Sé visual."
    if (course.category === 'programming') roleInstructions = "Eres Senior Dev. Si pides código, TERMINA con {{CODE_REQUEST}}. Evalúa sintaxis."
    if (course.category === 'letters') roleInstructions = "Eres Profesor de Literatura. Lenguaje elegante."
    
    return `CONTEXTO: Curso "${course.title}". ${syllabusPrompt}. ROL: ${roleInstructions}. REGLAS: 1. Si preguntas, usa {{Opción A|Opción B|...}} SIEMPRE. 2. Si pides código, {{CODE_REQUEST}}. 3. Respuestas bonitas.`
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

  const renderRichText = (text: string, category: CourseCategory) => {
    if (!text) return null
    return text.split(/(```[\s\S]*?```)/g).map((block, i) => {
      if (block.startsWith('```')) {
        const code = block.slice(3, -3).replace(/^.*\n/, '')
        return (
          <div key={i} className="my-4 rounded-xl overflow-hidden border border-gray-700 bg-[#1e1e1e] shadow-lg">
            <div className="bg-[#2d2d2d] px-4 py-2 text-xs text-gray-400 border-b border-gray-700"><Terminal className="w-3 h-3 inline mr-2"/> Ejemplo</div>
            <pre className="p-4 overflow-x-auto text-sm font-mono text-[#abb2bf]" dangerouslySetInnerHTML={{ __html: highlightCode(code) }} />
          </div>
        )
      }
      let fmt = block
      if (category === 'math') fmt = fmt.replace(/\$\$(.*?)\$\$/g, '<div class="my-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg text-center font-serif text-xl">$1</div>').replace(/\$(.*?)\$/g, '<span class="font-serif italic bg-gray-100 dark:bg-gray-800 px-1.5 rounded mx-1 font-medium">$1</span>')
      fmt = fmt.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-indigo-600 dark:text-indigo-400">$1</strong>').replace(/^\* (.*$)/gm, '<li class="ml-5 list-disc marker:text-indigo-500 mb-1">$1</li>').replace(/\n/g, '<br/>')
      return <span key={i} dangerouslySetInnerHTML={{ __html: fmt }} className={category === 'letters' ? 'font-serif text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300'}/>
    })
  }

  // --- 5. LÓGICA DE SÍLABO (BLOQUES) ---
  const generateSyllabus = async () => {
    if (!selectedCourse) return
    alert("Generando plan de estudios estructurado...")
    // Pedimos un JSON array estricto a la IA
    const res = await chatWithGemini(`Genera un sílabo de 5 temas clave para el curso "${selectedCourse.title}" (${selectedCourse.category}). Responde SOLAMENTE con un array JSON de strings válidos. Ejemplo: ["Tema 1", "Tema 2"]`, "System", [])
    
    if (res.success) {
      try {
        // Limpiamos la respuesta por si la IA añade texto extra
        const jsonMatch = res.message.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const items = JSON.parse(jsonMatch[0])
          setSyllabusItems(items)
        } else {
          // Fallback si no es JSON
          setSyllabusItems(res.message.split('\n').filter(l => l.trim().length > 0))
        }
      } catch (e) {
        alert("Error procesando respuesta IA, intenta de nuevo.")
      }
    }
  }

  const saveSyllabus = async () => {
    if (!selectedCourse) return
    const jsonSyllabus = JSON.stringify(syllabusItems)
    const { error } = await supabase.from('courses').update({ syllabus: jsonSyllabus }).eq('id', selectedCourse.id)
    if (!error) { 
        alert("Sílabo guardado exitosamente"); 
        setSelectedCourse({ ...selectedCourse, syllabus: jsonSyllabus }); 
    }
  }

  const addSyllabusItem = () => setSyllabusItems([...syllabusItems, "Nuevo tema"])
  const updateSyllabusItem = (index: number, val: string) => {
    const newItems = [...syllabusItems]
    newItems[index] = val
    setSyllabusItems(newItems)
  }
  const removeSyllabusItem = (index: number) => {
    const newItems = syllabusItems.filter((_, i) => i !== index)
    setSyllabusItems(newItems)
  }

  // --- OTRAS ACCIONES ---
  const createOrUpdateCourse = async () => {
    try {
      const payload = { title: newCourseTitle, description: newCourseDesc, category: newCourseCategory }
      if (editingCourseId) await supabase.from('courses').update(payload).eq('id', editingCourseId)
      else await supabase.from('courses').insert({ ...payload, created_by: user.id })
      setNewCourseTitle(''); setNewCourseDesc(''); setEditingCourseId(null); setView('courses'); fetchCourses('teacher', user.id)
    } catch (e: any) { alert(e.message) }
  }
  const deleteCourse = async (id: number) => { if (confirm("¿Eliminar?")) { await supabase.from('courses').delete().eq('id', id); fetchCourses('teacher', user.id); } }
  const leaveCourse = async (id: number) => { if (confirm("¿Salir?")) { await supabase.from('enrollments').delete().eq('course_id', id).eq('student_id', user.id); fetchCourses('student', user.id); } }
  const scheduleSession = async () => {
    await supabase.from('sessions').insert({ course_id: selectedCourse!.id, ...sessionData })
    setShowSessionForm(false); fetchSessions(selectedCourse!.id); alert("Sesión creada")
  }
  
  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') { e.preventDefault(); e.currentTarget.setRangeText('  ', e.currentTarget.selectionStart, e.currentTarget.selectionStart, 'end'); }
    const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']', '"': '"', "'": "'" };
    if (pairs[e.key]) {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      e.currentTarget.setRangeText(e.key + pairs[e.key], start, e.currentTarget.selectionEnd, 'end');
      e.currentTarget.selectionStart = start + 1; e.currentTarget.selectionEnd = start + 1;
    }
  }

  // --- INIT DEL SÍLABO EN EDICIÓN ---
  const initSyllabusEditor = (course: Course) => {
    try {
      if (course.syllabus) {
        const parsed = JSON.parse(course.syllabus)
        if (Array.isArray(parsed)) setSyllabusItems(parsed)
        else setSyllabusItems(course.syllabus.split('\n')) // Retrocompatibilidad texto plano
      } else {
        setSyllabusItems([])
      }
    } catch { setSyllabusItems([]) }
  }

  if (!mounted) return null
  if (loadingProfile) return <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><RefreshCw className="animate-spin text-blue-600 w-8 h-8"/></div>

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#020617] transition-colors duration-300 font-sans text-sm md:text-base overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-20 lg:w-72 bg-white dark:bg-[#0f172a] border-r border-gray-200 dark:border-gray-800 flex flex-col z-20 shadow-xl">
        <div className="p-6 flex items-center gap-3 border-b dark:border-gray-800">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><GraduationCap /></div>
          <span className="font-bold text-xl dark:text-white hidden lg:block tracking-tight">E-Learning</span>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => { setView('courses'); if (user && profile) fetchCourses(profile.role, user.id); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'courses' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}><Book className="w-5 h-5" /> <span className="hidden lg:block">Mis Cursos</span></button>
          <button onClick={() => { setView('create'); setEditingCourseId(null); setNewCourseTitle(''); setNewCourseDesc(''); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'create' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 font-semibold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{profile?.role === 'teacher' ? <Plus className="w-5 h-5" /> : <Search className="w-5 h-5" />} <span className="hidden lg:block">{profile?.role === 'teacher' ? 'Crear Curso' : 'Explorar'}</span></button>
        </nav>
        <div className="p-4 border-t dark:border-gray-800 flex gap-2">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 flex justify-center hover:bg-gray-200 dark:hover:bg-gray-700"><Sun className="w-5 h-5 hidden dark:block"/><Moon className="w-5 h-5 block dark:hidden"/></button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="flex-1 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 flex justify-center hover:bg-red-100 dark:hover:bg-red-900/40"><LogOut className="w-5 h-5"/></button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* LISTA CURSOS */}
        {view === 'courses' && (
          <div className="flex-1 overflow-y-auto p-8">
            <h1 className="text-2xl font-bold dark:text-white mb-6">Mis Cursos</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myCourses.map(c => (
                <div key={c.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border dark:border-gray-700 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all relative group duration-300">
                  <div className={`h-32 p-6 flex flex-col justify-end relative ${c.category === 'math' ? 'bg-gradient-to-br from-blue-500 to-cyan-400' : c.category === 'programming' ? 'bg-gradient-to-br from-slate-700 to-slate-900' : c.category === 'letters' ? 'bg-gradient-to-br from-amber-500 to-orange-400' : 'bg-gradient-to-br from-indigo-500 to-purple-500'}`}>
                     <span className="absolute top-4 right-4 bg-white/20 text-white text-xs px-2 py-1 rounded backdrop-blur-md uppercase font-bold tracking-wider">{c.category}</span>
                     <h3 className="text-white font-bold text-xl drop-shadow-md">{c.title}</h3>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">{c.description}</p>
                    <div className="flex gap-2">
                      {profile?.role === 'teacher' ? (
                        <>
                          <button onClick={() => { setSelectedCourse(c); initSyllabusEditor(c); fetchEnrolledStudents(c.id); fetchSessions(c.id); setView('course_detail'); }} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-600">Administrar</button>
                          <button onClick={() => { setEditingCourseId(c.id); setNewCourseTitle(c.title); setNewCourseDesc(c.description); setNewCourseCategory(c.category); setView('create'); }} className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100"><Edit className="w-4 h-4"/></button>
                          <button onClick={() => deleteCourse(c.id)} className="p-2 text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setSelectedCourse(c); setView('course_detail'); fetchSessions(c.id); fetchChatHistory(c.id); }} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-500/20">Entrar al Aula</button>
                          <button onClick={() => leaveCourse(c.id)} className="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100"><LogOut className="w-4 h-4"/></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DETALLE CURSO */}
        {view === 'course_detail' && selectedCourse && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-[#0b1120] relative">
               <div className="h-16 bg-white dark:bg-gray-900 border-b dark:border-gray-800 flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
                 <div className="flex items-center gap-3">
                   <button onClick={() => setView('courses')} className="text-gray-400 hover:text-indigo-600 transition-colors"><ArrowLeft/></button>
                   <h2 className="font-bold dark:text-white text-lg">{selectedCourse.title}</h2>
                 </div>
                 {profile?.role === 'student' && <span className="text-xs font-mono text-green-500 bg-green-500/10 px-2 py-1 rounded-full flex items-center gap-1">● En vivo</span>}
               </div>

               {profile?.role === 'teacher' ? (
                 <div className="flex-1 p-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                   
                   {/* Columna Estudiantes */}
                   <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border dark:border-gray-700 h-fit">
                     <h3 className="font-bold text-lg mb-4 flex items-center gap-2 dark:text-white"><Users className="w-5 h-5 text-indigo-500"/> Estudiantes Inscritos ({enrolledStudents.length})</h3>
                     {enrolledStudents.length === 0 ? <p className="text-gray-400 text-sm italic">Esperando inscripciones...</p> : (
                       <ul className="space-y-3">{enrolledStudents.map(st => (<li key={st.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"><div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">{st.full_name?.[0]?.toUpperCase() || 'U'}</div><span className="text-sm dark:text-gray-200 font-medium">{st.full_name || 'Usuario sin nombre'}</span></li>))}</ul>
                     )}
                   </div>

                   {/* Columna Sílabo (Bloques Editables) */}
                   <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border dark:border-gray-700 h-full flex flex-col">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg flex items-center gap-2 dark:text-white"><ListChecks className="w-5 h-5 text-green-500"/> Plan de Estudios</h3>
                        <button onClick={generateSyllabus} className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-green-200 transition-colors border border-green-200"><Lightbulb className="w-3 h-3"/> Generar con IA</button>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                        {syllabusItems.length === 0 && <p className="text-gray-400 text-sm text-center py-4 border border-dashed rounded-lg">El sílabo está vacío. Genéralo o agrega temas manualmente.</p>}
                        {syllabusItems.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-start group">
                            <div className="mt-2 text-gray-400"><GripVertical className="w-4 h-4"/></div>
                            <textarea 
                              value={item} 
                              onChange={(e) => updateSyllabusItem(idx, e.target.value)}
                              className="flex-1 bg-gray-50 dark:bg-gray-900 border dark:border-gray-600 rounded-lg p-3 text-sm resize-none focus:ring-1 focus:ring-indigo-500 outline-none dark:text-gray-200"
                              rows={2}
                            />
                            <button onClick={() => removeSyllabusItem(idx)} className="mt-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4"/></button>
                          </div>
                        ))}
                        <button onClick={addSyllabusItem} className="w-full py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2">+ Agregar Tema</button>
                     </div>
                     <button onClick={saveSyllabus} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"><Check className="w-4 h-4"/> Guardar Cambios</button>
                   </div>
                 </div>
               ) : (
                 <>
                   <div className="flex-1 overflow-y-auto p-6 space-y-6">
                     {messages.length === 0 && <div className="text-center py-20 opacity-60"><Bot className="w-16 h-16 mx-auto mb-4 text-indigo-300"/><p className="mb-4 dark:text-gray-300 font-medium">¡Bienvenido al curso de {selectedCourse.title}!</p><button onClick={() => initAiConversation(selectedCourse)} className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold hover:bg-indigo-700 shadow-lg animate-pulse">Comenzar Clase</button></div>}
                     {messages.map((msg, i) => (
                       <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-3xl mx-auto w-full animate-in slide-in-from-bottom-2 duration-300`}>
                         <div className={`flex gap-3 max-w-[95%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md ${msg.role === 'user' ? 'bg-indigo-500' : 'bg-green-600'}`}>{msg.role === 'user' ? <User className="text-white w-4 h-4"/> : <Bot className="text-white w-4 h-4"/>}</div>
                           <div className="flex flex-col gap-2 w-full">
                             <div className={`p-5 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-gray-800 dark:text-gray-100 rounded-tl-none border dark:border-gray-700'}`}>
                               <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.role === 'model' ? renderRichText(msg.content, selectedCourse.category) : msg.content}</div>
                             </div>
                             {msg.options && <div className="flex flex-wrap gap-2 mt-1 pl-2">{msg.options.map((opt, idx) => (<button key={idx} onClick={() => handleSendMessage(opt)} className="bg-white dark:bg-gray-800 border-2 border-indigo-100 dark:border-indigo-900/30 px-4 py-2 rounded-xl text-sm hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-medium dark:text-gray-300 transition-all transform active:scale-95">{opt}</button>))}</div>}
                             {msg.isCodeRequest && (
                               <div className="w-full bg-[#1e1e1e] rounded-xl overflow-hidden shadow-2xl border border-gray-700 mt-4">
                                 <div className="bg-[#252526] px-4 py-2 flex items-center justify-between border-b border-[#333]"><span className="text-gray-400 text-xs flex items-center gap-2 uppercase tracking-wider font-bold"><CodeIcon className="w-3 h-3 text-blue-400" /> Editor de Estudiante</span><div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"/><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"/><div className="w-2.5 h-2.5 rounded-full bg-green-500"/></div></div>
                                 <textarea ref={editorRef} disabled={!codeEditorVisible && i !== messages.length - 1} onKeyDown={handleCodeKeyDown} className="w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 h-64 outline-none resize-none selection:bg-blue-500/30 leading-relaxed" placeholder="// Escribe tu solución aquí..." value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} spellCheck={false}/>
                                 {codeEditorVisible && i === messages.length - 1 && (<div className="p-3 bg-[#252526] flex justify-end border-t border-[#333]"><button onClick={() => handleSendMessage()} className="bg-green-600 hover:bg-green-700 text-white px-5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 uppercase tracking-wide transition-all shadow-lg hover:shadow-green-500/20"><Play className="w-3 h-3" /> Ejecutar Código</button></div>)}
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
                       <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-full border dark:border-gray-700 focus-within:ring-2 focus-within:ring-indigo-500 shadow-inner transition-all">
                         <input className="flex-1 bg-transparent px-4 py-2 outline-none dark:text-white" placeholder="Escribe tu mensaje..." value={inputMsg} onChange={e => setInputMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} disabled={aiLoading}/>
                         <button onClick={() => handleSendMessage()} disabled={!inputMsg.trim()} className="p-2 bg-indigo-600 rounded-full text-white hover:bg-indigo-700 disabled:opacity-50 transition-transform hover:scale-105 active:scale-95 shadow-md"><Send className="w-4 h-4"/></button>
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
                 <button onClick={() => setShowSessionForm(!showSessionForm)} className="w-full mb-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-gray-500 text-xs font-bold hover:border-purple-500 hover:text-purple-500 uppercase flex items-center justify-center gap-2 transition-all"><Plus className="w-4 h-4"/> Nueva Sesión</button>
               )}
               {showSessionForm && (
                 <div className="mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border dark:border-gray-700 space-y-2 animate-in slide-in-from-top-2">
                   <input type="date" className="w-full p-2 text-xs rounded border dark:bg-gray-900 dark:border-gray-600 dark:text-white" onChange={e => setSessionData({...sessionData, date: e.target.value})}/>
                   <input type="time" className="w-full p-2 text-xs rounded border dark:bg-gray-900 dark:border-gray-600 dark:text-white" onChange={e => setSessionData({...sessionData, time: e.target.value})}/>
                   <input type="url" placeholder="Enlace (Zoom/Meet)" className="w-full p-2 text-xs rounded border dark:bg-gray-900 dark:border-gray-600 dark:text-white" onChange={e => setSessionData({...sessionData, link: e.target.value})}/>
                   <button className="w-full bg-purple-600 text-white py-1.5 rounded text-xs font-bold hover:bg-purple-700 shadow-md" onClick={async () => {
                     await supabase.from('sessions').insert({ course_id: selectedCourse.id, ...sessionData })
                     setShowSessionForm(false); fetchSessions(selectedCourse.id);
                   }}>Confirmar</button>
                 </div>
               )}
               <div className="space-y-2">
                 {courseSessions.length === 0 ? <p className="text-xs text-gray-400 text-center py-4 border border-dashed rounded-lg">No hay sesiones programadas</p> : courseSessions.map((s, i) => (
                   <div key={i} className="p-3 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group">
                     <p className="text-xs font-bold text-purple-700 dark:text-purple-300 flex justify-between">{s.date} <span>{s.time}</span></p>
                     <a href={s.link} target="_blank" className="mt-2 text-xs bg-white dark:bg-gray-800 border dark:border-gray-700 px-2 py-1.5 rounded flex items-center gap-1 w-full justify-center group-hover:text-purple-500 font-medium transition-colors"><ExternalLink className="w-3 h-3"/> Unirse a la reunión</a>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {/* CREAR */}
        {view === 'create' && (
          <div className="flex-1 overflow-y-auto p-8 flex justify-center">
             <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl border dark:border-gray-700 p-8 h-fit">
               <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold dark:text-white">{profile?.role === 'teacher' ? (editingCourseId ? 'Editar Curso' : 'Crear Curso') : 'Explorar'}</h2><button onClick={() => setView('courses')} className="text-gray-400 hover:text-gray-600">Cancelar</button></div>
               {profile?.role === 'teacher' ? (
                 <div className="space-y-6">
                   <div><label className="block text-sm font-bold mb-2 dark:text-gray-300">Título del Curso</label><input className="w-full p-3 border rounded-xl dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} /></div>
                   <div className="grid grid-cols-3 gap-3">{['math', 'letters', 'programming'].map(cat => <button key={cat} onClick={() => setNewCourseCategory(cat as any)} className={`p-3 rounded-xl border text-sm font-bold capitalize transition-all ${newCourseCategory === cat ? 'bg-indigo-100 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-gray-300'}`}>{cat === 'math' ? '📐 Matemáticas' : cat === 'letters' ? '📚 Letras' : '💻 Programación'}</button>)}</div>
                   <div><label className="block text-sm font-bold mb-2 dark:text-gray-300">Descripción</label><textarea className="w-full p-3 border rounded-xl h-32 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none" value={newCourseDesc} onChange={e => setNewCourseDesc(e.target.value)} /></div>
                   <button onClick={createOrUpdateCourse} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all transform hover:scale-[1.02]">Publicar Curso</button>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {courses.map(c => (
                     <div key={c.id} className="border dark:border-gray-700 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                       <h3 className="font-bold dark:text-white">{c.title}</h3><p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-4 line-clamp-2">{c.description}</p>
                       <button onClick={async () => { await supabase.from('enrollments').insert({ student_id: user.id, course_id: c.id }); fetchCourses('student', user.id); alert('Inscrito') }} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">Inscribirse</button>
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