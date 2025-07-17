# 🎥 VideoConvert Pro

💡 Um aplicativo moderno de conversão de vídeo, 100% client-side, feito inteiramente com auxílio da IA **v0.dev**.  
Todo o desenvolvimento da interface e estrutura inicial foi gerado através do v0, acelerando drasticamente a criação.

### 🚀 Tecnologias Utilizadas
- **Next.js 14**
- **React 18**
- **ffmpeg.wasm (WebAssembly)**
- **TailwindCSS**
- **shadcn/ui**
- **IndexedDB / LocalStorage**

---

## ✨ Funcionalidades Principais

### 🎬 Conversão de Vídeo Local (no Navegador)
- Formatos suportados: `.mp4`, `.mkv`, `.webm`, `.avi`
- Conversão rápida e segura, direto do navegador
- Comandos dinâmicos otimizados para diferentes formatos
- Isolamento de instâncias ffmpeg para cada conversão

### 📂 Gerenciamento de Fila
- Múltiplos arquivos adicionados simultaneamente
- Conversão sequencial inteligente
- Barra de progresso individual por item
- Cancelamento de itens específicos ou da fila completa

### 🕘 Histórico de Conversões
- Nome original, formato convertido, data e miniatura
- Miniaturas geradas automaticamente (primeiro frame do vídeo)
- Persistência garantida via IndexedDB / LocalStorage
- Downloads disponíveis diretamente do histórico
- Limpeza completa do histórico a qualquer momento

### 🛑 Validação Inteligente
- Avisos ao tentar converter para o mesmo formato
- Limite de tamanho por arquivo (500MB)
- Mensagens claras de erro e status

---

## 🌙 Experiência de Usuário (UI/UX)
- **Modo Claro / Escuro**
- **Idiomas: Português 🇧🇷 e Inglês 🇺🇸**
- Interface moderna, responsiva e gerada com v0.dev
- Drag-and-drop para uploads
- Indicadores claros de status (pendente, convertendo, concluído)

---

## 🔥 Porque esse projeto é relevante?
- Privacidade total: nada sai do seu navegador
- Não requer servidores, APIs ou backends
- Excelente exemplo prático de uso de **WebAssembly** para aplicações reais
- Demonstrativo do poder e produtividade do **v0.dev**

---

## 🛠️ Como rodar localmente
```bash
git clone https://github.com/seu-usuario/videoconvert-pro.git
cd videoconvert-pro
npm install
npm run dev
