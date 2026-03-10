import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

function isAuthorized(request: NextRequest): boolean {
    const configuredSecret = process.env.REVALIDATE_SECRET;
    const providedSecret = request.headers.get('x-revalidate-secret');

    if (configuredSecret && providedSecret === configuredSecret) {
        return true;
    }

    const appOrigin = request.nextUrl.origin;
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    return origin === appOrigin || referer?.startsWith(appOrigin) === true;
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ message: 'Unauthorized revalidation request' }, { status: 401 });
    }

    try {
        revalidatePath('/');

        return NextResponse.json({ revalidated: true, now: Date.now() });
    } catch {
        return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
    }
}
