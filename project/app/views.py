from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny
import threading
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from langchain_community.document_loaders import PyMuPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_classic.chains import RetrievalQA
from langchain_classic.llms import LlamaCpp
import os

PDF_DIR = "uploads"
CHROMA_DB_DIR = "vectorstore"
MODEL_PATH = "./models/Llama-3.2-1B-Instruct-Q4_K_M.gguf"

_llm = None
_llm_lock = threading.Lock()
_embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

def get_llm():
    global _llm
    with _llm_lock:
        if _llm is None:
            try:
                _llm = LlamaCpp(
                    model_path=MODEL_PATH,
                    temperature=0.0,
                    n_ctx=4096,
                    verbose=False
                )
            except Exception as e:
                print(f"Error loading LlamaCpp model: {e}")
        return _llm

@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf(request):
    return JsonResponse({"ok": True})

@api_view(['POST'])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def api_upload(request):
    file = request.FILES.get('file')

    if not file:
        return Response({"error": "File not found!"}, status=400)
    
    if file.content_type != 'application/pdf':
        return Response({"error": "Only PDF files are allowed"}, status=400)

    os.makedirs(PDF_DIR, exist_ok=True)
    pdf_path = os.path.join(PDF_DIR, file.name)

    with open(pdf_path, "wb+") as f:
        for chunk in file.chunks():
            f.write(chunk)

    try:
        loader = PyMuPDFLoader(pdf_path)
        docs = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(docs)

        os.makedirs(CHROMA_DB_DIR, exist_ok=True)
        Chroma.from_documents(splits, embedding=_embeddings, persist_directory=CHROMA_DB_DIR)

        return Response({"message": f"File '{file.name}' uploaded and vectorstore created successfully!"})
    except Exception as e:
        return Response({"error": f"Error processing PDF or creating vectorstore: {str(e)}"}, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def api_chat(request):
    try:
        user_message = request.data.get("message", "").strip()
        if not user_message:
            return Response({"error": "Empty message"}, status=400)
        
        llm = get_llm()
        if llm is None:
            return Response({"error": "LLM model failed to load."}, status=500)

        db = Chroma(persist_directory=CHROMA_DB_DIR, embedding_function=_embeddings)
        retriever = db.as_retriever(search_kwargs={"k": 3})

        qa_chain = RetrievalQA.from_chain_type(
            llm=llm, 
           
            retriever=retriever
        )
        
        result = qa_chain.invoke({"query": user_message})
        answer = result.get("result") or "No answer found."

        return Response({"response": answer})
    except Exception as e:
        return Response({"error": f"Internal error: {str(e)}"}, status=500)
