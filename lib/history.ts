export interface HistoryEntry {
  id: string
  originalFilename: string
  convertedFilename: string
  outputFormat: string
  thumbnailBlob: ArrayBuffer // Armazena os dados brutos da miniatura
  thumbnailType: string // Armazena o tipo MIME da miniatura
  convertedBlob: ArrayBuffer
  blobType: string
  timestamp: string
}

const DB_NAME = "VideoConverterDB"
const DB_VERSION = 1
const STORE_NAME = "conversions"
const LOCALSTORAGE_KEY = "videoConverter-history" // Chave de fallback

class HistoryDB {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        console.log("IndexedDB: Banco de dados já inicializado.")
        resolve()
        return
      }
      console.log("IndexedDB: Tentando abrir/criar banco de dados...")
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = (event) => {
        console.error("IndexedDB: Erro ao abrir banco de dados:", (event.target as IDBOpenDBRequest).error)
        reject((event.target as IDBOpenDBRequest).error)
      }
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        console.log("IndexedDB: Banco de dados aberto com sucesso.")
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        console.log("IndexedDB: Upgrade necessário. Criando/atualizando object store.")
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
          store.createIndex("timestamp", "timestamp", { unique: false })
          console.log("IndexedDB: Object store 'conversions' e índice 'timestamp' criados.")
        }
      }
    })
  }

  async saveEntry(entry: HistoryEntry): Promise<void> {
    if (!this.db) {
      console.warn("IndexedDB: Banco de dados não inicializado. Tentando inicializar antes de salvar.")
      await this.init()
    }

    return new Promise((resolve, reject) => {
      console.log(`IndexedDB: Iniciando transação para salvar entrada ${entry.id}.`)
      const transaction = this.db!.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)

      const entryToStore = {
        ...entry,
        convertedBlob: entry.convertedBlob,
        blobType: entry.blobType,
        thumbnailBlob: entry.thumbnailBlob, // Salva o ArrayBuffer da miniatura
        thumbnailType: entry.thumbnailType, // Salva o tipo da miniatura
      }

      const request = store.put(entryToStore)
      request.onsuccess = () => {
        console.log(`IndexedDB: Entrada ${entry.id} salva com sucesso.`)
        resolve()
      }
      request.onerror = (event) => {
        console.error(`IndexedDB: Erro ao salvar entrada ${entry.id}:`, (event.target as IDBRequest).error)
        reject((event.target as IDBRequest).error)
      }
    })
  }

  async getEntries(): Promise<HistoryEntry[]> {
    if (!this.db) {
      console.warn("IndexedDB: Banco de dados não inicializado. Tentando inicializar antes de obter entradas.")
      await this.init()
    }

    return new Promise((resolve, reject) => {
      console.log("IndexedDB: Iniciando transação para obter entradas.")
      const transaction = this.db!.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index("timestamp")
      const request = index.getAll()

      request.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result
        console.log(`IndexedDB: ${result.length} entradas obtidas.`)
        const entries = result.map((entry: any) => ({
          ...entry,
          convertedBlob: entry.convertedBlob,
          blobType: entry.blobType,
          thumbnailBlob: entry.thumbnailBlob, // Recupera o ArrayBuffer da miniatura
          thumbnailType: entry.thumbnailType, // Recupera o tipo da miniatura
        }))

        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        resolve(entries)
      }
      request.onerror = (event) => {
        console.error("IndexedDB: Erro ao obter entradas:", (event.target as IDBRequest).error)
        reject((event.target as IDBRequest).error)
      }
    })
  }

  async clearEntries(): Promise<void> {
    if (!this.db) {
      console.warn("IndexedDB: Banco de dados não inicializado. Tentando inicializar antes de limpar.")
      await this.init()
    }

    return new Promise((resolve, reject) => {
      console.log("IndexedDB: Iniciando transação para limpar object store.")
      const transaction = this.db!.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        console.log("IndexedDB: Object store limpo com sucesso.")
        resolve()
      }
      request.onerror = (event) => {
        console.error("IndexedDB: Erro ao limpar object store:", (event.target as IDBRequest).error)
        reject((event.target as IDBRequest).error)
      }
    })
  }
}

export const historyDB = new HistoryDB()

export async function saveToHistory(entry: HistoryEntry): Promise<void> {
  try {
    await historyDB.saveEntry(entry)
    console.log("Histórico: Entrada salva com sucesso no IndexedDB.")
  } catch (error) {
    console.error(
      "Histórico: Falha ao salvar no IndexedDB. Tentando fallback para localStorage (apenas metadados):",
      error,
    )

    try {
      const existingHistory = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || "[]")
      const entryForStorage = {
        ...entry,
        convertedBlob: null, // Não é possível armazenar Blobs/ArrayBuffers diretamente no localStorage
        thumbnailBlob: null, // Não é possível armazenar Blobs/ArrayBuffers diretamente no localStorage
        blobType: entry.blobType,
        thumbnailType: entry.thumbnailType,
        blobSize: entry.convertedBlob.byteLength, // Armazena o tamanho do ArrayBuffer
        thumbnailSize: entry.thumbnailBlob.byteLength, // Armazena o tamanho do ArrayBuffer da miniatura
      }
      existingHistory.unshift(entryForStorage)
      existingHistory.splice(50)
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(existingHistory))
      console.log("Histórico: Entrada salva no localStorage (apenas metadados).")
    } catch (localStorageError) {
      console.error("Histórico: Falha ao salvar no localStorage:", localStorageError)
    }
  }
}

export async function getHistory(): Promise<HistoryEntry[]> {
  try {
    const entries = await historyDB.getEntries()
    console.log(`Histórico: ${entries.length} entradas carregadas do IndexedDB.`)
    return entries.map((entry) => ({
      ...entry,
      // Gera a URL da miniatura a partir do ArrayBuffer para exibição
      thumbnail: entry.thumbnailBlob
        ? URL.createObjectURL(new Blob([entry.thumbnailBlob], { type: entry.thumbnailType }))
        : "",
    })) as HistoryEntry[] // Adiciona o cast para incluir a propriedade 'thumbnail'
  } catch (error) {
    console.error("Histórico: Falha ao obter histórico do IndexedDB. Tentando localStorage (apenas metadados):", error)

    try {
      const history = JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY) || "[]")
      console.log(`Histórico: ${history.length} entradas carregadas do localStorage (apenas metadados).`)
      return history.map((entry: any) => ({
        ...entry,
        convertedBlob: entry.convertedBlob || new ArrayBuffer(0),
        blobType: entry.blobType || "application/octet-stream",
        thumbnailBlob: entry.thumbnailBlob || new ArrayBuffer(0), // Dummy ArrayBuffer
        thumbnailType: entry.thumbnailType || "image/jpeg", // Dummy type
        thumbnail: "/placeholder.svg", // Fallback para placeholder
      }))
    } catch (localStorageError) {
      console.error("Histórico: Falha ao obter histórico do localStorage:", localStorageError)
      return []
    }
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await historyDB.clearEntries()
    localStorage.removeItem(LOCALSTORAGE_KEY)
    console.log("Histórico: Limpo do IndexedDB e localStorage.")
  } catch (error) {
    console.error("Histórico: Falha ao limpar histórico:", error)
  }
}
