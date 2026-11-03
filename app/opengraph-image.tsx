
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'NGIPEN - Satu Hobby Satu Keseruan';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          backgroundColor: '#ffffff',
        }}
      >
        <img
          src="https://ngipen-makicos-seven.vercel.app/ngipen-og-preview.png"
          width={1200}
          height={630}
          style={{
            width: '1200px',
            height: '630px',
            objectFit: 'cover',
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
