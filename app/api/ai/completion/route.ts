// app/api/ai/completion/route.ts
// API endpoint for inline code completions in Monaco Editor

import { NextRequest, NextResponse } from 'next/server';
import { aiService } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
  try {
    // Optional: Check authentication
    // const session = await getServerSession();
    // if (!session) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const body = await request.json();
    const { code, cursorPosition, language } = body;

    // Validate input
    if (!code || !cursorPosition || !language) {
      return NextResponse.json(
        { error: 'Missing required fields: code, cursorPosition, language' },
        { status: 400 }
      );
    }

    if (!cursorPosition.line || !cursorPosition.column) {
      return NextResponse.json(
        { error: 'Invalid cursor position' },
        { status: 400 }
      );
    }

    // Check if AI service is available
    // Support both a boolean property and a function; coerce to boolean to avoid testing `void`
    const isAvailable = typeof aiService.isAvailable === 'function'
      ? aiService.isAvailable()
      : aiService.isAvailable;

    if (!Boolean(isAvailable)) {
      return NextResponse.json(
        { error: 'AI service not configured. Please set GROQ_API_KEY.' },
        { status: 503 }
      );
    }

    // Generate completion
    const completion = await aiService.generateCompletion(
      code,
      cursorPosition,
      language
    );

    return NextResponse.json({
      success: true,
      completion,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Completion API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate completion',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// Use Edge Runtime for faster cold starts and lower latency
export const runtime = 'edge';