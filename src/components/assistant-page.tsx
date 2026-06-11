'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Bot, User, Send, Sparkles, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { chat, ChatMessage } from '@/ai/flows/chat-flow';
import { useSite } from '@/context/site-context';
import { ScrollArea } from './ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  message: z.string().min(1, 'Please enter a message.'),
});

export function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { sites } = useSite();
  const { toast } = useToast();
  
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const recognitionRef = useRef<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
    },
  });

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
      window.speechSynthesis.speak(utterance);
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
  }, [messages]);

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
      });
      console.log(assistantResponse,'assistantResponse')
      const assistantMessage: ChatMessage = { role: 'model', content: assistantResponse };
      setMessages(prev => [...prev, assistantMessage]);

      if (voiceEnabled) {
        speakText(assistantResponse);
      }

    } catch (error) {
      console.error('Chat failed:', error);
      const errorMessage: ChatMessage = {
        role: 'model',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-[calc(100vh-8rem)] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles /> AI Assistant</CardTitle>
        <CardDescription>Ask me anything about your construction projects, or anything else!</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
          <div className="space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 border border-dashed rounded-lg">
                  <div className="flex flex-col items-center justify-center p-6 bg-background rounded-lg ">
                      <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Inventra Assistant</h3>
                      <p className="text-muted-foreground">How can I help you today?</p>
                  </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`flex items-start gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'model' && (
                  <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                    <AvatarFallback><Bot /></AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-2xl rounded-lg p-4 prose dark:prose-invert ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback><User /></AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-4">
                <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                  <AvatarFallback><Bot /></AvatarFallback>
                </Avatar>
                <div className="max-w-xl rounded-lg p-4 bg-muted flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Thinking...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleListening}
            className={`flex-shrink-0 ${isListening ? 'text-destructive bg-destructive/10 hover:bg-destructive/20 animate-pulse' : 'text-muted-foreground'}`}
            title={isListening ? "Listening... Click to stop" : "Use Voice Input"}
            disabled={isLoading}
          >
            {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
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
            className={`flex-shrink-0 ${voiceEnabled ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-muted-foreground'}`}
            title={voiceEnabled ? "Voice Output On" : "Voice Output Off"}
            disabled={isLoading}
          >
            {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>

          <Controller
            name="message"
            control={form.control}
            render={({ field }) => (
              <Textarea
                {...field}
                placeholder={isListening ? "Listening..." : "Ask your question here..."}
                rows={1}
                className="flex-1 resize-none"
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
          <Button type="submit" size="icon" disabled={isLoading}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
