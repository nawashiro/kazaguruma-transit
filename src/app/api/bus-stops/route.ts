import { NextResponse } from 'next/server';
import { TransitService } from '@/lib/transit/transit-service';

export async function GET() {
  try {
    const transitService = TransitService.getInstance();
    const routes = await transitService.getAllRoutesWithStops();
    
    return NextResponse.json({
      success: true,
      data: routes,
    });
  } catch (error) {
    console.error('Failed to get bus stops:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch bus stops',
      },
      { status: 500 }
    );
  }
}