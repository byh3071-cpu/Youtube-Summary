import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

function isAuthorized(request: NextRequest): boolean {
    // 외부 자동화(크론·웹훅) 전용. 인앱 새로고침은 서버 액션(revalidateHomeAction)이 담당한다.
    // origin/referer 헤더는 비브라우저 요청이 위조할 수 있어 인증 수단으로 쓰지 않고,
    // 시크릿 일치로만 인가한다. 미설정 시 비활성(fail-closed).
    const configuredSecret = process.env.REVALIDATE_SECRET;
    if (!configuredSecret) return false;

    const providedSecret = request.headers.get('x-revalidate-secret');
    return providedSecret === configuredSecret;
}

export async function POST(request: NextRequest) {
    // 개발 환경에서는 보안 토큰 없이도 항상 허용 (개발 편의를 위해)
    if (process.env.NODE_ENV !== 'production') {
        try {
            revalidatePath('/');
            return NextResponse.json({ revalidated: true, now: Date.now() });
        } catch {
            return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
        }
    }

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
