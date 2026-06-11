
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, Mail, Building, Send, FileUp, Phone, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LandingPageContent } from '@/lib/types';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

// Simplified EditableText component for this context
const EditableText = ({ value, onSave, multiline = false }: { value: string, onSave: (newValue: string) => void, multiline?: boolean }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);

  const handleSave = () => {
    onSave(currentValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 my-2">
        {multiline ? (
          <textarea value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} className="w-full p-2 border rounded bg-background" rows={3} />
        ) : (
          <input value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} className="w-full p-2 border rounded bg-background" />
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => setIsEditing(true)} className="p-1 -m-1 border border-transparent hover:border-primary/50 hover:bg-primary/10 rounded-md cursor-pointer transition-all">
      {multiline ? <p>{value}</p> : <h1>{value}</h1>}
    </div>
  );
};

export default function ContactPageEditor() {
  const [content, setContent] = useState<Partial<LandingPageContent>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const docRef = doc(db, 'site_content', 'landing_page');
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as LandingPageContent;
        setContent({
          contactTitle: data.contactTitle || 'Get in Touch',
          contactSubtitle: data.contactSubtitle || 'We’d love to hear from you. Please fill out the form below.'
        });
      } else {
         setContent({
          contactTitle: 'Get in Touch',
          contactSubtitle: 'We’d love to hear from you. Please fill out the form below.'
        });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'site_content', 'landing_page'), content, { merge: true });
      toast({ title: 'Success', description: 'Contact page content has been updated.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save content.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = (key: keyof LandingPageContent, value: any) => {
    setContent(prev => ({ ...prev, [key]: value }));
  };
  
  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Mail /> Contact Page Editor</CardTitle>
            <CardDescription>Click on any text to edit it directly. Save your changes when you're done.</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save All Changes
          </Button>
        </CardHeader>
      </Card>
      
      <div className="p-4 rounded-lg border bg-background/50">
        <div className="w-full max-w-4xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center mb-12">
            <div className="text-4xl sm:text-5xl font-extrabold text-foreground">
              <EditableText value={content.contactTitle || ''} onSave={(v) => handleUpdate('contactTitle', v)} />
            </div>
            <div className="mt-4 text-lg text-muted-foreground">
              <EditableText value={content.contactSubtitle || ''} onSave={(v) => handleUpdate('contactSubtitle', v)} multiline />
            </div>
          </div>
          {/* Static form preview */}
          <Card className="bg-card/50 border border-border p-6 sm:p-8 shadow-lg backdrop-blur-sm rounded-2xl">
            <CardContent className="p-0">
               <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div><Label>Full Name</Label><Input placeholder="Your Name" readOnly/></div>
                    <div><Label>Email Address</Label><Input placeholder="you@example.com" readOnly/></div>
                </div>
                <div><Label>Company (Optional)</Label><Input placeholder="Your Company" readOnly/></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                     <div><Label>Subject</Label><Input placeholder="Inquiry about..." readOnly/></div>
                     <div><Label>Reason for Contact</Label><Input placeholder="Select a reason" readOnly/></div>
                </div>
                <div><Label>Message</Label><Textarea placeholder="Your message..." readOnly/></div>
                 <div className="text-center pt-4">
                  <Button size="lg" disabled><Send className="mr-2 h-4 w-4" /> Send Message</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
