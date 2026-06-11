
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, Globe, CheckCircle, ArrowRight, Construction, Warehouse, Bot, Linkedin, Twitter, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import Image from 'next/image';
import { Logo } from './ui/logo';
import HumanCharacter from './HumanCharacter';
import Link from 'next/link';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { LandingPageContent } from '@/lib/types';
import * as LucideIcons from 'lucide-react';

// Helper to get icon component from string
const getIcon = (name: string) => {
  const Icon = (LucideIcons as any)[name];
  return Icon ? <Icon className="h-6 w-6" /> : <Construction className="h-6 w-6" />;
}

// Editable Components
const EditableText = ({ value, onSave, multiline = false, isProse = false }: { value: string, onSave: (newValue: string) => void, multiline?: boolean, isProse?: boolean }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);

  const handleSave = () => {
    onSave(currentValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 my-2">
        <Textarea value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} className="bg-background/80 min-h-[100px]" />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }
  
  const proseClasses = "prose prose-invert prose-lg max-w-none text-muted-foreground prose-headings:text-foreground prose-a:text-primary hover:prose-a:text-primary/80";

  return (
    <div onClick={() => setIsEditing(true)} className={`p-1 -m-1 border border-transparent hover:border-primary/50 hover:bg-primary/10 rounded-md cursor-pointer transition-all ${isProse ? proseClasses : ''}`}>
      {isProse ? <div dangerouslySetInnerHTML={{ __html: value.replace(/\n/g, '<br />') }} /> : value}
    </div>
  );
};


const EditableImage = ({ src, onSave, hint }: { src: string, onSave: (newUrl: string) => void, hint: string }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [imageUrl, setImageUrl] = useState(src);
    const { toast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        setImageUrl(src);
    }, [src]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const storageRef = ref(storage, `landing_page/${file.name}_${Date.now()}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            setImageUrl(downloadURL);
            onSave(downloadURL);
            toast({ title: 'Image updated successfully!' });
        } catch (error) {
            console.error('Image upload failed:', error);
            toast({ variant: 'destructive', title: 'Upload failed', description: 'Could not upload the new image.' });
        } finally {
            setIsUploading(false);
        }
    };
    
    return (
        <div className="relative group w-32 h-32 mx-auto">
            <Image
                key={imageUrl} // Force re-render when URL changes
                src={imageUrl}
                alt="Editable image"
                width={128}
                height={128}
                className="rounded-full object-cover border-4 border-primary/10 transition-transform duration-300 group-hover:scale-110 w-full h-full"
                data-ai-hint={hint}
            />
            <Button
                size="sm"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
            >
                {isUploading ? <Loader2 className="animate-spin" /> : 'Change'}
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>
    );
};


// Default content structure
const defaultContent: LandingPageContent = {
  heroTitle: 'Inventra — Construction & Manufacturing Management, Reimagined',
  heroSubtitle: 'A unified, multi-tenant platform to manage sites, track inventory, run production, streamline finances and get AI-powered insights — all from one secure dashboard.',
  aboutTitle: 'About Inventra',
  aboutDescription: 'Inventra combines construction site management and manufacturing operations into a single platform. We help businesses reduce material waste, improve labour utilisation and accelerate delivery timelines by connecting field data, inventory control and financial workflows.',
  aboutImageUrl: '/about/about.jpg',
  features: [
    { icon: 'Construction', title: 'Unified Site Management', text: 'Oversee multiple construction sites and manufacturing units from a single, intuitive dashboard.' },
    { icon: 'Warehouse', title: 'Real-Time Inventory', text: 'Track materials from warehouse to worksite, manage stock levels, and get low-stock alerts.' },
    { icon: 'Bot', title: 'AI-Powered Insights', text: 'Leverage our AI Assistant to analyze project data, model threats, and extract insights from documents.' }
  ],
  solutions: [
    { title: "Site Management", desc: "Tasks, schedules, permits & safety checklists" },
    { title: "Field App", desc: "Mobile reporting, attendance and asset scanning" },
    { title: "Inventory & BOM", desc: "Stock, warehouses, transfers & procurement" },
    { title: "Manufacturing", desc: "Work orders, routing, and production planning" },
    { title: "Analytics", desc: "Dashboards, KPIs, cost & timeline forecasting" },
    { title: "Finance", desc: "Estimates, invoices, payroll & supplier payments" },
    { title: "AI Tools", desc: "Document analysis, risk detection & automated insights" },
    { title: "Integrations", desc: "APIs, ERPs, accounting systems & IoT sensors" }
  ],
  team: [
    { name: 'Abhinav Goyal', role: 'Co-Founder', imageUrl: '/team/member1.jpg', bio: 'Abhinav leads product and engineering with a passion for building scalable and user-centric solutions.', linkedin: '#', twitter: '#' },
    { name: 'Hardik Bansal', role: 'Co-Founder', imageUrl: '/team/member2.jpg', bio: 'Hardik drives business strategy and customer success, ensuring our partners achieve their goals.', linkedin: '#', twitter: '#' }
  ],
  ctaTitle: 'Ready to streamline your projects?',
  ctaSubtitle: 'Get a personalized demo and see how Inventra can reduce costs and accelerate delivery.',
  privacyPolicyContent: `<h2>Introduction</h2><p>This Privacy Policy explains how Inventra collects, uses, stores, and protects information when you access or use our construction and operations management platform and any related services...</p>`,
  termsOfServiceContent: `<h2>Introduction</h2><p>These Terms of Service govern your use of the Inventra construction and operations management platform...</p>`,
  refundPolicyContent: `<h2>Introduction</h2><p>This Refund Policy describes how payments and subscription charges are handled when using the Inventra platform...</p>`,
};


export default function LandingPageEditor() {
  const [content, setContent] = useState<LandingPageContent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const docRef = doc(db, 'site_content', 'landing_page');
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const firestoreData = doc.data() as LandingPageContent;
        // Merge data, but prioritize local default image URLs if Firestore has picsum URLs
        const mergedTeam = (firestoreData.team || []).map((member, index) => {
          const defaultMember = defaultContent.team[index];
          if (member.imageUrl && member.imageUrl.includes('picsum.photos') && defaultMember) {
            return { ...member, imageUrl: defaultMember.imageUrl };
          }
          return member;
        });

        const mergedContent = { 
          ...defaultContent, 
          ...firestoreData,
          team: mergedTeam,
        };

        if (firestoreData.aboutImageUrl && firestoreData.aboutImageUrl.includes('picsum.photos')) {
          mergedContent.aboutImageUrl = defaultContent.aboutImageUrl;
        }

        setContent(mergedContent);
      } else {
        setContent(defaultContent);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'site_content', 'landing_page'), content, { merge: true });
      toast({ title: 'Success', description: 'Landing page content has been updated.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save content.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleUpdate = (key: keyof LandingPageContent, value: any) => {
    setContent(prev => prev ? { ...prev, [key]: value } : null);
  };
  
  const handleNestedUpdate = <T extends { [key: string]: any }>(section: keyof LandingPageContent, index: number, field: keyof T, value: string) => {
      setContent(prev => {
          if (!prev) return null;
          const sectionArray = prev[section] as T[];
          const newArray = [...sectionArray];
          newArray[index] = { ...newArray[index], [field]: value };
          return { ...prev, [section]: newArray };
      });
  };

  const addFeature = () => {
    const newFeature = { icon: 'ShieldCheck', title: 'New Feature', text: 'Describe the new feature here.' };
    handleUpdate('features', [...(content?.features || []), newFeature]);
  };
  
  const removeFeature = (index: number) => {
    handleUpdate('features', content?.features.filter((_, i) => i !== index));
  };

  const addSolution = () => {
    const newSolution = { title: 'New Solution', desc: 'Describe the new solution.' };
    handleUpdate('solutions', [...(content?.solutions || []), newSolution]);
  };

  const removeSolution = (index: number) => {
    handleUpdate('solutions', content?.solutions.filter((_, i) => i !== index));
  };
  
  const addTeamMember = () => {
    const newMember = { name: 'New Member', role: 'Role', imageUrl: '/team/new-member.jpg', bio: 'A brief bio.', linkedin: '#', twitter: '#' };
    handleUpdate('team', [...(content?.team || []), newMember]);
  }
  
  const removeTeamMember = (index: number) => {
    handleUpdate('team', content?.team.filter((_, i) => i !== index));
  };


  if (!content) {
    return <div className="flex items-center justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><Globe /> Landing Page Editor</CardTitle>
                    <CardDescription>Click on any text to edit it directly. Changes are saved when you click the "Save All Changes" button.</CardDescription>
                </div>
                <Button onClick={handleSave} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save All Changes
                </Button>
            </CardHeader>
        </Card>

        {/* This is the live preview rendering */}
        <div className="p-4 rounded-lg border bg-background/50 scale-90 origin-top-left w-[111%] overflow-x-auto no-scrollbar">
             {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
              <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3">
                  <Logo />
                  <div className="font-semibold text-lg text-foreground">Inventra</div>
                </Link>
                <div className="flex items-center gap-2">
                  <Button variant="ghost">Login</Button>
                  <Button>Sign Up</Button>
                </div>
              </div>
            </header>

            {/* Hero Section */}
            <main className="relative z-10">
              <div className="mx-auto max-w-6xl px-6 py-20 sm:py-32 text-center">
                  <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight text-foreground">
                    <EditableText value={content.heroTitle} onSave={(v) => handleUpdate('heroTitle', v)} />
                  </h1>
                  <p className="mt-6 max-w-3xl mx-auto text-muted-foreground text-lg">
                    <EditableText value={content.heroSubtitle} onSave={(v) => handleUpdate('heroSubtitle', v)} multiline/>
                  </p>
                  <div className="mt-10 flex items-center justify-center gap-4">
                    <Button size="lg">Start 2-Month Free Trial</Button>
                    <Button size="lg" variant="outline">Learn More</Button>
                  </div>
              </div>
              <div className="mx-auto max-w-6xl px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center h-full w-full rounded-2xl bg-card/10 p-2 border-border/10">
                  <div className="h-64 md:h-96 w-full flex items-center justify-center"><HumanCharacter /></div>
                  <div className="h-64 md:h-96 w-full flex items-center justify-center">
                    {/* Placeholder for typewriter animation */}
                    <div className="text-2xl font-bold">Manage your projects with ease.</div>
                  </div>
                </div>
              </div>
            </main>

            {/* About Section */}
            <section className="mx-auto max-w-6xl px-6 py-12 sm:py-24 grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl font-extrabold text-foreground">
                    <EditableText value={content.aboutTitle} onSave={(v) => handleUpdate('aboutTitle', v)} />
                  </h2>
                  <p className="mt-4 text-muted-foreground">
                    <EditableText value={content.aboutDescription} onSave={(v) => handleUpdate('aboutDescription', v)} multiline />
                  </p>
                </div>
                <div className="relative h-80 rounded-2xl overflow-hidden border border-border/50 flex items-center justify-center">
                    <EditableImage src={content.aboutImageUrl} onSave={(v) => handleUpdate('aboutImageUrl', v)} hint="construction site architecture" />
                </div>
            </section>

            {/* Features Section */}
            <section className="mx-auto max-w-7xl px-6 py-12 sm:py-24 bg-secondary/20 rounded-3xl">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-extrabold text-foreground">Powerful Features for Modern Operations</h2>
                    <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">Everything you need to streamline your construction and manufacturing projects, all in one place.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                    {content.features.map((feature, index) => (
                        <div key={index} className="relative group rounded-2xl bg-card/50 border border-white/10 p-6 shadow-lg backdrop-blur-sm">
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="destructive" onClick={() => removeFeature(index)}><Trash2/></Button>
                            </div>
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                {getIcon(feature.icon)}
                            </div>
                            <h5 className="font-semibold text-foreground">
                                <EditableText value={feature.title} onSave={(v) => handleNestedUpdate('features', index, 'title', v)} />
                            </h5>
                            <p className="mt-2 text-sm text-muted-foreground">
                                <EditableText value={feature.text} onSave={(v) => handleNestedUpdate('features', index, 'text', v)} multiline />
                            </p>
                        </div>
                    ))}
                    <div className="absolute -bottom-4 right-4">
                        <Button onClick={addFeature}><Plus className="mr-2"/>Add Feature</Button>
                    </div>
                </div>
            </section>
            
            {/* Solutions Section */}
            <section id="solutions" className="mx-auto max-w-7xl px-6 py-12 sm:py-24">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-extrabold text-foreground">One Platform, Endless Solutions</h2>
                <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">Modular solutions designed to work together — pick the modules you need and scale as your business grows.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                {content.solutions.map((solution, index) => (
                  <div key={index} className="relative group rounded-2xl bg-card/50 border border-border p-6 transition-all duration-300 hover:border-primary/50 hover:-translate-y-1">
                     <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="destructive" onClick={() => removeSolution(index)}><Trash2/></Button>
                    </div>
                    <h4 className="font-semibold text-foreground">
                       <EditableText value={solution.title} onSave={(v) => handleNestedUpdate('solutions', index, 'title', v)} />
                    </h4>
                    <p className="mt-2 text-sm text-muted-foreground">
                      <EditableText value={solution.desc} onSave={(v) => handleNestedUpdate('solutions', index, 'desc', v)} multiline />
                    </p>
                  </div>
                ))}
                 <div className="absolute -bottom-4 right-4">
                    <Button onClick={addSolution}><Plus className="mr-2"/>Add Solution</Button>
                </div>
              </div>
            </section>

             {/* Team Section */}
            <section className="mx-auto max-w-6xl px-6 py-12 sm:py-24">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-extrabold text-foreground">Meet the Team</h2>
                    <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">The minds behind Inventra, dedicated to revolutionizing the industry.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 justify-center relative">
                    {content.team.map((member, index) => (
                        <div key={index} className="group relative rounded-2xl bg-card/50 border border-border p-6 text-center">
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="destructive" onClick={() => removeTeamMember(index)}><Trash2/></Button>
                            </div>
                            <EditableImage src={member.imageUrl} onSave={(v) => handleNestedUpdate('team', index, 'imageUrl', v)} hint="person business"/>
                            <h4 className="font-semibold text-lg text-foreground mt-4">
                                <EditableText value={member.name} onSave={(v) => handleNestedUpdate('team', index, 'name', v)} />
                            </h4>
                            <p className="text-sm text-primary/80">
                                <EditableText value={member.role} onSave={(v) => handleNestedUpdate('team', index, 'role', v)} />
                            </p>
                            <p className="text-sm text-muted-foreground mt-2">
                                <EditableText value={member.bio} onSave={(v) => handleNestedUpdate('team', index, 'bio', v)} multiline/>
                            </p>
                        </div>
                    ))}
                     <div className="absolute -bottom-4 right-4">
                        <Button onClick={addTeamMember}><Plus className="mr-2"/>Add Team Member</Button>
                    </div>
                </div>
            </section>

             {/* CTA Section */}
            <section className="mx-auto max-w-5xl px-6 py-12 sm:py-24">
              <div className="rounded-2xl bg-gradient-to-br from-primary/90 to-primary p-8 sm:p-12 border border-primary/30 text-center">
                <h4 className="text-2xl sm:text-3xl font-extrabold text-primary-foreground">
                   <EditableText value={content.ctaTitle} onSave={(v) => handleUpdate('ctaTitle', v)} />
                </h4>
                <p className="mt-4 text-primary-foreground/80 max-w-xl mx-auto">
                    <EditableText value={content.ctaSubtitle} onSave={(v) => handleUpdate('ctaSubtitle', v)} multiline />
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button size="lg" className="bg-background text-foreground hover:bg-background/90 w-full sm:w-auto transition-transform hover:scale-105 duration-300">Start 2-Month Free Trial</Button>
                  <Button asChild size="lg" variant="outline" className="bg-transparent text-primary-foreground border-primary-foreground/50 hover:bg-primary-foreground/10 w-full sm:w-auto transition-colors duration-300">
                    <Link href="/contact">Contact Sales</Link>
                  </Button>
                </div>
              </div>
            </section>
        </div>
    </div>
  );
}

    