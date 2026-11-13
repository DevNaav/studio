'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Bot, User, Send, Sparkles, Mic, MicOff, Volume2, VolumeX, MessageSquare, X, Minimize2, Maximize2 } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { chat, ChatMessage } from '@/ai/flows/chat-flow';
import { getIdTokenOrThrow } from '@/lib/id-token';
import { useSite } from '@/context/site-context';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  message: z.string().min(1, 'Please enter a message.'),
});

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { sites } = useSite();
  const { toast } = useToast();

  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
    },
  });

  // Setup speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        rec.onresult = (event: any) => {
          const resultText = event.results[0][0].transcript;
          form.setValue('message', resultText, { shouldValidate: true });
        };

        rec.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, [form]);

  // Monitor speaking status
  useEffect(() => {
    let interval: any;
    if (voiceEnabled) {
      interval = setInterval(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          setIsSpeaking(window.speechSynthesis.speaking);
        }
      }, 200);
    } else {
      setIsSpeaking(false);
    }
    return () => clearInterval(interval);
  }, [voiceEnabled]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({
        variant: 'destructive',
        title: 'Speech Not Supported',
        description: 'Speech recognition is not supported in this browser. Please try Chrome or Edge.',
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        recognitionRef.current.start();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [messages, isOpen, isLoading]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const userMessage: ChatMessage = { role: 'user', content: values.message };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    form.reset();

    try {
      const assistantResponse = await chat({
        history: messages,
        message: values.message,
        sites: sites.map(s => s.name),
      }, await getIdTokenOrThrow());

      const assistantMessage: ChatMessage = { role: 'model', content: assistantResponse };
      setMessages(prev => [...prev, assistantMessage]);

      if (voiceEnabled) {
        speakText(assistantResponse);
      }

    } catch (error) {
      console.error('Chat failed:', error);
      const errorMessage: ChatMessage = {
        role: 'model',
        content: 'Sorry, I encountered an error. Please verify your Gemini API key in Settings.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes soundwave-pulse {
          0% { height: 4px; }
          100% { height: 22px; }
        }
        @keyframes fab-glow {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
      `}</style>

      {/* Floating Action Button */}
      <div
        id="tour-step-4-copilot"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full flex items-center justify-center cursor-pointer shadow-2xl transition-all duration-300 ${isOpen ? 'scale-90 bg-destructive/20 border-destructive/40' : 'bg-primary/20 border-primary/40 hover:scale-110 hover:-translate-y-1'}`}
        style={{
          backdropFilter: 'blur(12px)',
          borderWidth: '1px',
          boxShadow: isOpen ? '0 0 25px rgba(239, 68, 68, 0.4)' : '0 0 25px rgba(147, 51, 234, 0.4)'
        }}
      >
        {/* Glow Ring Behind FAB */}
        {!isOpen && (
          <div className="absolute inset-0 rounded-full bg-primary/30 blur-md pointer-events-none animate-[fab-glow_3s_infinite_ease-in-out]" />
        )}

        {isOpen ? (
          <X className="h-6 w-6 text-destructive animate-in spin-in-90 duration-300" />
        ) : (
          <MessageSquare className="h-6 w-6 text-primary animate-in zoom-in duration-300" />
        )}
      </div>

      {/* Glassmorphic Chat Window */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-96 h-[520px] flex flex-col rounded-2xl border border-white/10 bg-black/45 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in-20"
          style={{
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Avatar className="h-8 w-8 bg-primary/20 border border-primary/40">
                  <AvatarFallback className="bg-transparent"><Bot className="h-4 w-4 text-primary" /></AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border border-black animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  Inventra Co-Pilot
                  <Sparkles className="h-3 w-3 text-yellow-400 animate-pulse" />
                </h3>
                <p className="text-[10px] text-muted-foreground">Always active to assist you</p>
              </div>
            </div>

            {/* Soundwave/Listening Indicator inside Header */}
            {(isListening || isSpeaking) && (
              <div className="flex items-end gap-[2px] h-5 px-2 bg-primary/10 rounded-full border border-primary/20 animate-pulse">
                <span className="w-[2px] bg-primary rounded-full animate-[soundwave-pulse_0.6s_ease-in-out_infinite_alternate]" style={{ height: '4px', animationDelay: '0.1s' }} />
                <span className="w-[2px] bg-primary rounded-full animate-[soundwave-pulse_0.6s_ease-in-out_infinite_alternate]" style={{ height: '8px', animationDelay: '0.3s' }} />
                <span className="w-[2px] bg-primary rounded-full animate-[soundwave-pulse_0.6s_ease-in-out_infinite_alternate]" style={{ height: '14px', animationDelay: '0.5s' }} />
                <span className="w-[2px] bg-primary rounded-full animate-[soundwave-pulse_0.6s_ease-in-out_infinite_alternate]" style={{ height: '10px', animationDelay: '0.2s' }} />
                <span className="w-[2px] bg-primary rounded-full animate-[soundwave-pulse_0.6s_ease-in-out_infinite_alternate]" style={{ height: '4px', animationDelay: '0.4s' }} />
              </div>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-hidden relative">
            <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
              <div className="space-y-4 pr-2">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-72 text-center p-6 bg-white/5 border border-dashed border-white/10 rounded-xl">
                    <Bot className="h-10 w-10 text-primary mb-3 animate-bounce" />
                    <h4 className="text-sm font-semibold text-white">Ask your Co-Pilot</h4>
                    <p className="text-xs text-muted-foreground max-w-[200px] mt-1 leading-relaxed">
                      I can help you build projects, track sites, manage resources, and more!
                    </p>
                  </div>
                )}

                {messages.map((message, index) => (
                  <div key={index} className={`flex items-start gap-2.5 ${message.role === 'user' ? 'justify-end' : ''}`}>
                    {message.role === 'model' && (
                      <Avatar className="h-7 w-7 bg-primary/20 border border-primary/40">
                        <AvatarFallback className="bg-transparent"><Bot className="h-3.5 w-3.5 text-primary" /></AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`max-w-[75%] rounded-2xl p-3 text-xs leading-relaxed ${message.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-white/5 border border-white/10 text-white rounded-tl-none'}`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'user' && (
                      <Avatar className="h-7 w-7 bg-primary">
                        <AvatarFallback className="text-white"><User className="h-3.5 w-3.5" /></AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-start gap-2.5">
                    <Avatar className="h-7 w-7 bg-primary/20 border border-primary/40 animate-pulse">
                      <AvatarFallback className="bg-transparent"><Bot className="h-3.5 w-3.5 text-primary" /></AvatarFallback>
                    </Avatar>
                    <div className="max-w-[75%] rounded-2xl p-3 bg-white/5 border border-white/10 text-muted-foreground text-xs flex items-center gap-2 rounded-tl-none animate-pulse">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Footer Input */}
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="p-3 border-t border-white/10 bg-white/5 flex items-center gap-2"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleListening}
              className={`h-8 w-8 rounded-full transition-all duration-300 ${isListening ? 'text-destructive bg-destructive/10 hover:bg-destructive/20 animate-pulse scale-105' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
              title={isListening ? "Listening... Click to stop" : "Use Voice Input"}
              disabled={isLoading}
            >
              {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setVoiceEnabled(!voiceEnabled);
                if (voiceEnabled) {
                  window.speechSynthesis?.cancel();
                }
              }}
              className={`h-8 w-8 rounded-full transition-all duration-300 ${voiceEnabled ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
              title={voiceEnabled ? "Voice Output On" : "Voice Output Off"}
              disabled={isLoading}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>

            <Controller
              name="message"
              control={form.control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  placeholder={isListening ? "Listening..." : "Message Co-Pilot..."}
                  rows={1}
                  className="flex-1 min-h-[36px] max-h-[100px] py-2 px-3 resize-none bg-white/5 border-white/10 text-white placeholder-white/30 text-xs rounded-xl focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary/50"
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      form.handleSubmit(onSubmit)();
                    }
                  }}
                />
              )}
            />

            <Button
              type="submit"
              size="icon"
              className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 flex-shrink-0"
              disabled={isLoading}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
