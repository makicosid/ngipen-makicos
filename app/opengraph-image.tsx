import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'NGIPEN - Satu Hobby Satu Keseruan';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#111111',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background accent kiri bawah */}
        <div
          style={{
            position: 'absolute',
            bottom: '-120px',
            left: '-120px',
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            backgroundColor: 'rgba(160,30,30,0.18)',
            display: 'flex',
          }}
        />
        {/* Background accent kanan atas */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-120px',
            width: '420px',
            height: '420px',
            borderRadius: '50%',
            backgroundColor: 'rgba(180,90,0,0.18)',
            display: 'flex',
          }}
        />

        {/* Logo */}
        <img
          src="https://ngipen-makicos-seven.vercel.app/ngipen-logo.png"
          width={160}
          height={160}
          style={{ objectFit: 'contain', marginBottom: '20px' }}
        />

        {/* Judul */}
        <div
          style={{
            fontSize: '72px',
            fontWeight: '900',
            color: '#E8A020',
            letterSpacing: '-1px',
            marginBottom: '10px',
            display: 'flex',
          }}
        >
          NGIPEN
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#F5F5F5',
            letterSpacing: '3px',
            marginBottom: '24px',
            display: 'flex',
          }}
        >
          Satu Hobby · Satu Keseruan
        </div>

        {/* Garis */}
        <div
          style={{
            width: '100px',
            height: '4px',
            backgroundColor: '#E8A020',
            borderRadius: '4px',
            marginBottom: '24px',
            display: 'flex',
          }}
        />

        {/* Deskripsi */}
        <div
          style={{
            fontSize: '22px',
            color: '#CCCCCC',
            textAlign: 'center',
            maxWidth: '720px',
            lineHeight: '1.5',
            display: 'flex',
          }}
        >
          Platform event jejepangan, cosplay, idol, toys dan market Indonesia
        </div>

        {/* Badge kategori */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '14px',
            marginTop: '30px',
          }}
        >
          {['Cosplay', 'Idol', 'Toys', 'Market', 'Game'].map((tag) => (
            <div
              key={tag}
              style={{
                backgroundColor: 'rgba(232,160,32,0.15)',
                border: '2px solid rgba(232,160,32,0.5)',
                color: '#E8A020',
                borderRadius: '24px',
                padding: '8px 20px',
                fontSize: '18px',
                fontWeight: '700',
                display: 'flex',
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        {/* URL pojok kanan bawah */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '32px',
            color: '#555555',
            fontSize: '16px',
            display: 'flex',
          }}
        >
          ngipen-makicos-seven.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
