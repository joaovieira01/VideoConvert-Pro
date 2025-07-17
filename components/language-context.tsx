"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

type Language = "en" | "pt"

interface LanguageContextType {
  language: Language
  toggleLanguage: () => void
  t: Translations
}

interface Translations {
  hero: {
    title: string
    subtitle: string
  }
  info: {
    title: string
    description: string
  }
  warning: {
    message: string
  }
  tabs: {
    converter: string
    history: string
  }
  upload: {
    title: string
    dropTitle: string
    dropSubtitle: string
    button: string
    limits: string
    outputFormat: string
    // Removido URL related translations
    // urlTitle: string
    // urlPlaceholder: string
  }
  queue: {
    title: string
    clear: string
    pending: string
    converting: string
    completed: string
    error: string
  }
  history: {
    title: string
    clear: string
    empty: string
    download: string
  }
  buttons: {
    convert: string
    download: string
    change: string
  }
  progress: {
    converting: string
  }
  success: {
    message: string
  }
  errors: {
    invalidFormat: string
    fileTooLarge: string
    conversionFailed: string
    // Removido URL related translations
    // urlDownloadFailed: string
    sameFormat: string
  }
  footer: {
    text: string
  }
}

const translations: Record<Language, Translations> = {
  en: {
    hero: {
      title: "Advanced Video Converter",
      subtitle:
        "Convert between .mkv, .avi, .webm, and .mp4 formats easily and privately. Process multiple files, view conversion history. All processing happens inside your browser.",
    },
    info: {
      title: "How it works",
      description:
        "This tool uses WebAssembly (ffmpeg.wasm) to convert your videos directly in your browser. Your files never leave your device, ensuring complete privacy and security. Process multiple files in queue and keep track of your conversion history.",
    },
    warning: {
      message:
        "Conversion performance depends on your browser and device. Large files may cause delays or fail to process depending on available memory.",
    },
    tabs: {
      converter: "Converter",
      history: "History",
    },
    upload: {
      title: "Upload & Convert",
      dropTitle: "Drop multiple video files here",
      dropSubtitle: "or click to browse and select files",
      button: "Choose Files",
      limits: "Supported: .mkv, .webm, .avi, .mp4 • Max: 500MB each",
      outputFormat: "Output Format",
      // Removido URL related translations
      // urlTitle: "Or download from URL",
      // urlPlaceholder: "Paste video URL here...",
    },
    queue: {
      title: "Conversion Queue",
      clear: "Clear Queue",
      pending: "Pending",
      converting: "Converting",
      completed: "Completed",
      error: "Error",
    },
    history: {
      title: "Conversion History",
      clear: "Clear History",
      empty: "No conversions yet. Start converting videos to see them here.",
      download: "Download",
    },
    buttons: {
      convert: "Convert to MP4",
      download: "Download MP4",
      change: "Change File",
    },
    progress: {
      converting: "Converting...",
    },
    success: {
      message: "Video converted successfully! You can now download your file.",
    },
    errors: {
      invalidFormat: "Invalid file format. Please select a supported video file.",
      fileTooLarge: "File is too large. Please select a file smaller than 500MB.",
      conversionFailed:
        "Conversion failed. Please try again with a different file or check your browser's memory availability.",
      // Removido URL related translations
      // urlDownloadFailed: "Failed to download file from URL. Please check the URL and try again.",
      sameFormat: "Cannot convert {format} to the same format. Please choose a different output format.",
    },
    footer: {
      text: "Built with Next.js, Tailwind CSS, and ffmpeg.wasm • All processing happens in your browser",
    },
  },
  pt: {
    hero: {
      title: "Conversor de Vídeo Avançado",
      subtitle:
        "Converta entre formatos .mkv, .avi, .webm e .mp4 de forma fácil e privada. Processe múltiplos arquivos, visualize histórico de conversões. Todo processamento acontece no seu navegador.",
    },
    info: {
      title: "Como funciona",
      description:
        "Esta ferramenta usa WebAssembly (ffmpeg.wasm) para converter seus vídeos diretamente no seu navegador. Seus arquivos nunca saem do seu dispositivo, garantindo privacidade e segurança completas. Processe múltiplos arquivos em fila e acompanhe seu histórico de conversões.",
    },
    warning: {
      message:
        "A performance da conversão depende do seu navegador e dispositivo. Arquivos grandes podem causar atrasos ou falhar no processamento dependendo da memória disponível.",
    },
    tabs: {
      converter: "Conversor",
      history: "Histórico",
    },
    upload: {
      title: "Upload e Conversão",
      dropTitle: "Solte múltiplos arquivos de vídeo aqui",
      dropSubtitle: "ou clique para navegar e selecionar arquivos",
      button: "Escolher Arquivos",
      limits: "Suportados: .mkv, .webm, .avi, .mp4 • Máx: 500MB cada",
      outputFormat: "Formato de Saída",
      // Removido URL related translations
      // urlTitle: "Ou baixar de URL",
      // urlPlaceholder: "Cole a URL do vídeo aqui...",
    },
    queue: {
      title: "Fila de Conversão",
      clear: "Limpar Fila",
      pending: "Pendente",
      converting: "Convertendo",
      completed: "Concluído",
      error: "Erro",
    },
    history: {
      title: "Histórico de Conversões",
      clear: "Limpar Histórico",
      empty: "Nenhuma conversão ainda. Comece convertendo vídeos para vê-los aqui.",
      download: "Baixar",
    },
    buttons: {
      convert: "Converter para MP4",
      download: "Baixar MP4",
      change: "Trocar Arquivo",
    },
    progress: {
      converting: "Convertendo...",
    },
    success: {
      message: "Vídeo convertido com sucesso! Agora você pode baixar seu arquivo.",
    },
    errors: {
      invalidFormat: "Formato de arquivo inválido. Por favor, selecione um arquivo de vídeo suportado.",
      fileTooLarge: "Arquivo muito grande. Por favor, selecione um arquivo menor que 500MB.",
      conversionFailed:
        "Falha na conversão. Tente novamente com um arquivo diferente ou verifique a disponibilidade de memória do seu navegador.",
      // Removido URL related translations
      // urlDownloadFailed: "Falha ao baixar arquivo da URL. Verifique a URL e tente novamente.",
      sameFormat: "Não é possível converter {format} para o mesmo formato. Escolha um formato de saída diferente.",
    },
    footer: {
      text: "Construído com Next.js, Tailwind CSS e ffmpeg.wasm • Todo processamento acontece no seu navegador",
    },
  },
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en")

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "pt" : "en"))
  }

  const value: LanguageContextType = {
    language,
    toggleLanguage,
    t: translations[language],
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
