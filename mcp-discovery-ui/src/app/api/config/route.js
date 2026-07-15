export async function GET() {
  return Response.json({
    geminiApiKey: 'Default Server Key Pool'
  });
}

export const dynamic = 'force-dynamic';
