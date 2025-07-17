"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Upload,
  Download,
  FileVideo,
  AlertTriangle,
  Globe,
  Loader2,
  Info,
  X,
  Clock,
  History,
  Trash2,
  Moon,
  Sun,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import { LanguageProvider, useLanguage } from "@/components/language-context"
import { type HistoryEntry, saveToHistory, getHistory, clearHistory, historyDB } from "@/lib/history"
import { useTheme } from "@/components/theme-provider"

interface QueueItem {
  id: string
  file: File
  outputFormat: string
  status: "pending" | "converting" | "completed" | "error"
  progress: number
  convertedBlob?: ArrayBuffer
  thumbnailUrl?: string // URL temporária para exibição
  thumbnailBlob?: ArrayBuffer // Dados brutos da miniatura para persistência
  thumbnailType?: string // Tipo MIME da miniatura para persistência
  error?: string
  originalFormat?: string
}

export default function HomePage() {
  return (
    <LanguageProvider>
      <VideoConverterApp />
    </LanguageProvider>
  )
}

function VideoConverterApp() {
  const { t, language, toggleLanguage } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const [currentProcessingId, setCurrentProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [selectedOutputFormat, setSelectedOutputFormat] = useState("mp4")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const ffmpegRef = useRef<FFmpeg | null>(null)

  const supportedFormats = ["mp4", "mkv", "webm", "avi"]
  const maxFileSize = 500 * 1024 * 1024 // 500MB

  useEffect(() => {
    const initializeApp = async () => {
      await historyDB.init()
      loadHistory()
    }
    initializeApp()
  }, [])

  // Lógica centralizada e robusta de processamento da fila
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessingQueue) {
        console.log("Fila já está processando. Aguardando item atual terminar.")
        return
      }

      const nextItem = queue.find((item) => item.status === "pending")

      if (!nextItem) {
        console.log("Nenhum item pendente na fila. Fila inativa.")
        setIsProcessingQueue(false)
        setCurrentProcessingId(null)
        return
      }

      console.log(`Iniciando processamento do item: ${nextItem.file.name} (ID: ${nextItem.id})`)
      setIsProcessingQueue(true)
      setCurrentProcessingId(nextItem.id)

      setQueue((prevQueue) =>
        prevQueue.map((item) => (item.id === nextItem.id ? { ...item, status: "converting", progress: 0 } : item)),
      )

      let ffmpeg: FFmpeg | null = null
      let totalDurationSeconds = 0 // Variável para armazenar a duração total

      try {
        ffmpeg = new FFmpeg()
        ffmpegRef.current = ffmpeg
        console.log("Nova instância do FFmpeg criada e armazenada.")

        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"
        console.log(`Carregando FFmpeg para item ${nextItem.id}...`)
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        })
        console.log(`FFmpeg carregado para item ${nextItem.id}.`)

        const inputExt = nextItem.originalFormat || nextItem.file.name.split(".").pop()?.toLowerCase() || ""
        const inputName = `input.${inputExt}`
        const outputName = `output.${nextItem.outputFormat}`

        console.log(`Escrevendo arquivo de entrada para FFmpeg: ${inputName}`)
        await ffmpeg.writeFile(inputName, await fetchFile(nextItem.file))

        // --- Listener de progresso aprimorado via logs ---
        ffmpeg.on("log", ({ message }) => {
          // console.log(`FFmpeg Log (${nextItem.id}): ${message}`) // Manter este log para depuração geral

          // 1. Tenta extrair a duração total do vídeo (ocorre no início)
          const durationMatch = message.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
          if (durationMatch && totalDurationSeconds === 0) {
            const hours = Number.parseInt(durationMatch[1], 10)
            const minutes = Number.parseInt(durationMatch[2], 10)
            const seconds = Number.parseInt(durationMatch[3], 10)
            const ms = Number.parseInt(durationMatch[4], 10) * 10 // Convertendo centésimos para milissegundos
            totalDurationSeconds = hours * 3600 + minutes * 60 + seconds + ms / 1000
            console.log(`Duração total do vídeo ${nextItem.file.name}: ${totalDurationSeconds} segundos.`)
          }

          // 2. Tenta capturar o tempo de progresso (time=HH:MM:SS.ms)
          const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
          if (timeMatch && totalDurationSeconds > 0) {
            const hours = Number.parseInt(timeMatch[1], 10)
            const minutes = Number.parseInt(timeMatch[2], 10)
            const seconds = Number.parseInt(timeMatch[3], 10)
            const ms = Number.parseInt(timeMatch[4], 10) * 10 // Convertendo centésimos para milissegundos

            const currentTimeSeconds = hours * 3600 + minutes * 60 + seconds + ms / 1000
            let calculatedProgress = (currentTimeSeconds / totalDurationSeconds) * 100
            calculatedProgress = Math.min(100, Math.max(0, calculatedProgress)) // Garante que esteja entre 0 e 100

            const percentage = Math.round(calculatedProgress)

            // Atualiza o progresso apenas se for um valor diferente para evitar re-renderizações excessivas
            setQueue((prev) =>
              prev.map((item) =>
                item.id === nextItem.id && item.progress !== percentage ? { ...item, progress: percentage } : item,
              ),
            )
            // console.log(`Progresso calculado para ${nextItem.file.name}: ${percentage}% (Tempo: ${timeMatch[0]})`)
          }
        })
        // --- Fim do listener de progresso aprimorado ---

        const command = getFFmpegCommand(inputExt, nextItem.outputFormat)
        console.log(
          `Executando comando FFmpeg para ${nextItem.file.name}: -i ${inputName} ${command.join(" ")} ${outputName}`,
        )
        await ffmpeg.exec(["-i", inputName, ...command, outputName])

        console.log(`Lendo arquivo de saída: ${outputName}`)
        const data = await ffmpeg.readFile(outputName)
        const blob = new Blob([data], {
          type: `video/${nextItem.outputFormat === "mkv" ? "x-matroska" : nextItem.outputFormat}`,
        })

        const arrayBuffer = await blob.arrayBuffer()

        setQueue((prevQueue) =>
          prevQueue.map((item) =>
            item.id === nextItem.id
              ? { ...item, status: "completed", convertedBlob: arrayBuffer, progress: 100 }
              : item,
          ),
        )
        console.log(`Item ${nextItem.file.name} concluído com sucesso.`)

        const historyEntry: HistoryEntry = {
          id: nextItem.id,
          originalFilename: nextItem.file.name,
          convertedFilename: nextItem.file.name.replace(/\.[^/.]+$/, "") + "." + nextItem.outputFormat,
          outputFormat: nextItem.outputFormat,
          thumbnailBlob: nextItem.thumbnailBlob || new ArrayBuffer(0), // Usa o ArrayBuffer da miniatura
          thumbnailType: nextItem.thumbnailType || "image/jpeg", // Usa o tipo da miniatura
          convertedBlob: arrayBuffer,
          blobType: blob.type,
          timestamp: new Date().toISOString(),
        }

        await saveToHistory(historyEntry)
        await loadHistory()
      } catch (err) {
        console.error(`Erro ao processar item ${nextItem.file.name}:`, err)
        setQueue((prevQueue) =>
          prevQueue.map((item) =>
            item.id === nextItem.id ? { ...item, status: "error", error: t.errors.conversionFailed } : item,
          ),
        )
        setError(t.errors.conversionFailed)
      } finally {
        if (ffmpeg) {
          console.log(`Terminando instância do FFmpeg para item ${nextItem.id}.`)
          ffmpeg.terminate()
        }
        ffmpegRef.current = null
        setCurrentProcessingId(null)
        setIsProcessingQueue(false)
        console.log(`Processamento do item ${nextItem.file.name} finalizado.`)
      }
    }

    const timer = setTimeout(() => {
      processQueue()
    }, 100)

    return () => clearTimeout(timer)
  }, [queue, isProcessingQueue, t, currentProcessingId])

  const loadHistory = async () => {
    const historyData = await getHistory()
    setHistory(historyData)
    console.log(`Histórico carregado: ${historyData.length} entradas.`)
  }

  const initFFmpegForThumbnail = async () => {
    const ffmpeg = new FFmpeg()
    ffmpeg.on("log", ({ message }) => console.log(`FFmpeg Thumbnail Log: ${message}`))
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    })
    return ffmpeg
  }

  const validateFile = (file: File, outputFormat: string): string | null => {
    const extension = file.name.split(".").pop()?.toLowerCase()

    if (!supportedFormats.includes(extension || "")) {
      return t.errors.invalidFormat
    }

    if (file.size > maxFileSize) {
      return t.errors.fileTooLarge
    }

    if (extension === outputFormat) {
      return t.errors.sameFormat.replace("{format}", `.${extension}`)
    }

    return null
  }

  // Retorna o ArrayBuffer e o tipo MIME da miniatura
  const generateThumbnail = async (file: File): Promise<{ arrayBuffer: ArrayBuffer; type: string }> => {
    let ffmpeg: FFmpeg | null = null
    try {
      ffmpeg = await initFFmpegForThumbnail()
      const inputName = "thumb_input." + file.name.split(".").pop()
      const outputName = "thumbnail.jpg"

      await ffmpeg.writeFile(inputName, await fetchFile(file))
      await ffmpeg.exec([
        "-i",
        inputName,
        "-ss",
        "00:00:01",
        "-vframes",
        "1",
        "-q:v",
        "2",
        "-s",
        "160x120",
        "-update",
        "1",
        outputName,
      ])

      const data = await ffmpeg.readFile(outputName)
      return { arrayBuffer: data.buffer, type: "image/jpeg" }
    } catch (err) {
      console.error("Falha na geração da miniatura:", err)
      return { arrayBuffer: new ArrayBuffer(0), type: "image/jpeg" } // Retorna um ArrayBuffer vazio em caso de erro
    } finally {
      if (ffmpeg) {
        ffmpeg.terminate()
      }
    }
  }

  const addFilesToQueue = async (files: File[]) => {
    const newItems: QueueItem[] = []

    for (const file of files) {
      const originalFormat = file.name.split(".").pop()?.toLowerCase() || ""
      const validationError = validateFile(file, selectedOutputFormat)

      if (validationError) {
        setError(validationError)
        continue
      }

      const { arrayBuffer: thumbnailBlob, type: thumbnailType } = await generateThumbnail(file)
      const thumbnailUrl = thumbnailBlob
        ? URL.createObjectURL(new Blob([thumbnailBlob], { type: thumbnailType }))
        : "/placeholder.svg"

      const item: QueueItem = {
        id: Date.now() + Math.random().toString(),
        file,
        outputFormat: selectedOutputFormat,
        status: "pending",
        progress: 0,
        thumbnailUrl, // URL para exibição
        thumbnailBlob, // Dados brutos para persistência
        thumbnailType, // Tipo para persistência
        originalFormat,
      }

      newItems.push(item)
    }

    if (newItems.length > 0) {
      setQueue((prev) => [...prev, ...newItems])
      setError(null)
    }
  }

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    addFilesToQueue(Array.from(files))
  }

  const removeFromQueue = (id: string) => {
    setQueue((prev) => {
      const newQueue = prev.filter((item) => item.id !== id)
      if (id === currentProcessingId) {
        console.log(`Item ${id} removido da fila enquanto estava em conversão. Terminando FFmpeg.`)
        ffmpegRef.current?.terminate()
        ffmpegRef.current = null
        setCurrentProcessingId(null)
        setIsProcessingQueue(false)
      }
      return newQueue
    })
  }

  const getFFmpegCommand = (inputExt: string, outputExt: string): string[] => {
    const commands: Record<string, Record<string, string[]>> = {
      mp4: {
        mkv: ["-c:v", "copy", "-c:a", "copy"],
        webm: ["-c:v", "libvpx-vp9", "-c:a", "libvorbis"],
        avi: ["-c:v", "libx264", "-c:a", "mp3"],
      },
      mkv: {
        mp4: ["-c:v", "libx264", "-c:a", "aac"],
        webm: ["-c:v", "libvpx-vp9", "-c:a", "libvorbis"],
        avi: ["-c:v", "libx264", "-c:a", "mp3"],
      },
      webm: {
        mp4: ["-c:v", "libx264", "-c:a", "aac"],
        mkv: ["-c:v", "copy", "-c:a", "copy"],
        avi: ["-c:v", "libx264", "-c:a", "mp3"],
      },
      avi: {
        mp4: ["-c:v", "libx264", "-c:a", "aac"],
        mkv: ["-c:v", "copy", "-c:a", "copy"],
        webm: ["-c:v", "libvpx-vp9", "-c:a", "libvorbis"],
      },
    }

    return commands[inputExt]?.[outputExt] || ["-c:v", "libx264", "-c:a", "aac"]
  }

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const clearQueue = () => {
    if (ffmpegRef.current) {
      console.log("Limpando fila: Terminando FFmpeg atual.")
      ffmpegRef.current.terminate()
      ffmpegRef.current = null
    }
    setQueue([])
    setCurrentProcessingId(null)
    setIsProcessingQueue(false)
  }

  const clearHistoryData = async () => {
    await clearHistory()
    setHistory([])
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      handleFileSelect(e.dataTransfer.files)
    },
    [selectedOutputFormat],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        theme === "dark"
          ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white"
          : "bg-gradient-to-br from-slate-50 to-slate-100 text-gray-900"
      }`}
    >
      {/* Cabeçalho com alternador de Modo Escuro */}
      <header
        className={`border-b sticky top-0 z-50 transition-colors duration-200 ${
          theme === "dark" ? "bg-gray-900/80 border-gray-700" : "bg-white/80 border-gray-200"
        } backdrop-blur-sm`}
      >
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileVideo className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold">VideoConvert Pro</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Alternador de Modo Escuro */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="flex items-center gap-2 bg-transparent"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              className="flex items-center gap-2 bg-transparent"
            >
              <Globe className="w-4 h-4" />
              {language === "en" ? "PT" : "EN"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Seção Hero */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold mb-4">{t.hero.title}</h2>
          <p className="text-xl opacity-80 mb-6 max-w-3xl mx-auto">{t.hero.subtitle}</p>
        </div>

        {/* Seção de Informações */}
        <Card
          className={`mb-6 transition-colors duration-200 ${
            theme === "dark" ? "border-blue-800 bg-blue-950/50" : "border-blue-200 bg-blue-50/50"
          }`}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className={`font-semibold mb-2 ${theme === "dark" ? "text-blue-300" : "text-blue-900"}`}>
                  {t.info.title}
                </h3>
                <p className={`text-sm leading-relaxed ${theme === "dark" ? "text-blue-200" : "text-blue-800"}`}>
                  {t.info.description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seção de Aviso */}
        <Alert
          className={`mb-6 transition-colors duration-200 ${
            theme === "dark" ? "border-amber-800 bg-amber-950/50" : "border-amber-200 bg-amber-50"
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <AlertDescription className={theme === "dark" ? "text-amber-200" : "text-amber-800"}>
            {t.warning.message}
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="converter" className="space-y-6">
          <TabsList className={`grid w-full grid-cols-2 ${theme === "dark" ? "bg-gray-800" : "bg-gray-100"}`}>
            <TabsTrigger value="converter" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {t.tabs.converter}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              {t.tabs.history}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="converter" className="space-y-6">
            {/* Seção de Upload */}
            <Card className={theme === "dark" ? "bg-gray-800 border-gray-700" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  {t.upload.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Seleção de Formato de Saída */}
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium">{t.upload.outputFormat}:</label>
                  <Select value={selectedOutputFormat} onValueChange={setSelectedOutputFormat}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedFormats.map((format) => (
                        <SelectItem key={format} value={format}>
                          .{format}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Upload de Arquivo */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                    isDragOver
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-950/50"
                      : theme === "dark"
                        ? "border-gray-600 hover:border-gray-500 bg-gray-800/50"
                        : "border-gray-300 hover:border-gray-400 bg-white/50"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t.upload.dropTitle}</h3>
                  <p className="opacity-70 mb-4">{t.upload.dropSubtitle}</p>

                  <Button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700">
                    <Upload className="w-4 h-4 mr-2" />
                    {t.upload.button}
                  </Button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mkv,.webm,.avi,.mp4"
                    multiple
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                  />

                  <p className="text-sm opacity-60 mt-4">{t.upload.limits}</p>
                </div>

                {/* Seção de Upload por URL Removida */}
              </CardContent>
            </Card>

            {/* Fila com Barras de Progresso Individuais */}
            {queue.length > 0 && (
              <Card className={theme === "dark" ? "bg-gray-800 border-gray-700" : ""}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    {t.queue.title} ({queue.length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={clearQueue}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t.queue.clear}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {queue.map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 rounded-lg transition-colors duration-200 ${
                          theme === "dark" ? "bg-gray-700/50" : "bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-4 mb-3">
                          {/* Miniatura */}
                          <div className="w-16 h-12 rounded overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0">
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl || "/placeholder.svg"}
                                alt="Miniatura do vídeo"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FileVideo className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.file.name}</p>
                            <p className="text-xs opacity-70">
                              {(item.file.size / (1024 * 1024)).toFixed(2)} MB • .{item.originalFormat} → .
                              {item.outputFormat}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Badges de Status com Ícones */}
                            {item.status === "pending" && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {t.queue.pending}
                              </Badge>
                            )}
                            {item.status === "converting" && (
                              <Badge className="bg-blue-600 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {t.queue.converting}
                              </Badge>
                            )}
                            {item.status === "completed" && (
                              <>
                                <Badge className="bg-green-600 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  {t.queue.completed}
                                </Badge>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    downloadFile(
                                      new Blob([item.convertedBlob!], { type: item.file.type }),
                                      item.file.name.replace(/\.[^/.]+$/, "") + "." + item.outputFormat,
                                    )
                                  }
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {item.status === "error" && (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {t.queue.error}
                              </Badge>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => removeFromQueue(item.id)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Barra de Progresso Individual */}
                        {item.status === "converting" && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="opacity-70">{t.progress.converting}</span>
                              <span className="font-medium">{item.progress}%</span>
                            </div>
                            <Progress value={item.progress} className="h-2" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card className={theme === "dark" ? "bg-gray-800 border-gray-700" : ""}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  {t.history.title}
                </CardTitle>
                {history.length > 0 && (
                  <Button variant="outline" size="sm" onClick={clearHistoryData}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t.history.clear}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-8 opacity-60">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{t.history.empty}</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className={`border rounded-lg p-4 space-y-3 transition-colors duration-200 ${
                          theme === "dark" ? "border-gray-600 bg-gray-700/30" : "border-gray-200"
                        }`}
                      >
                        {/* Exibição Aprimorada da Miniatura */}
                        <div className="w-full h-24 rounded overflow-hidden bg-gray-200 dark:bg-gray-600">
                          {entry.thumbnail ? ( // Usa a propriedade 'thumbnail' que agora é gerada por getHistory
                            <img
                              src={entry.thumbnail || "/placeholder.svg"}
                              alt="Miniatura do vídeo"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FileVideo className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm truncate">{entry.originalFilename}</p>
                          <p className="text-xs opacity-70">→ {entry.convertedFilename}</p>
                          <p className="text-xs opacity-60">{new Date(entry.timestamp).toLocaleDateString()}</p>
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() =>
                            downloadFile(
                              new Blob([entry.convertedBlob], { type: entry.blobType }),
                              entry.convertedFilename,
                            )
                          }
                        >
                          <Download className="w-4 h-4 mr-2" />
                          {t.history.download}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Exibição Aprimorada de Erros */}
        {error && (
          <Alert
            className={`mt-6 transition-colors duration-200 ${
              theme === "dark" ? "border-red-800 bg-red-950/50" : "border-red-200 bg-red-50"
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <AlertDescription className={theme === "dark" ? "text-red-200" : "text-red-800"}>{error}</AlertDescription>
          </Alert>
        )}
      </main>

      {/* Rodapé */}
      <footer
        className={`border-t mt-16 transition-colors duration-200 ${
          theme === "dark" ? "bg-gray-900/80 border-gray-700" : "bg-white/80 border-gray-200"
        } backdrop-blur-sm`}
      >
        <div className="container mx-auto px-4 py-8 text-center opacity-70">
          <p>{t.footer.text}</p>
        </div>
      </footer>
    </div>
  )
}
