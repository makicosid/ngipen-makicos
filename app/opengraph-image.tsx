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
          background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 40%, #2a1a0a 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200,120,0,0.15) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-80px',
            left: '-80px',
            width: '350px',
            height: '350px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(180,30,30,0.12) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Logo image */}
        <img
          src="https://ngipen-makicos-seven.vercel.app/ngipen-logo.png"
          width={180}
          height={180}
          style={{ objectFit: 'contain', marginBottom: '24px' }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: '900',
            letterSpacing: '-1px',
            background: 'linear-gradient(90deg, #c0392b, #e67e22, #f1c40f)',
            backgroundClip: 'text',
            color: 'transparent',
            display: 'flex',
            marginBottom: '12px',
          }}
        >
          NGIPEN
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '26px',
            color: '#f0d090',
            fontWeight: '600',
            letterSpacing: '2px',
            marginBottom: '28px',
            display: 'flex',
          }}
        >
          Satu Hobby Satu Keseruan
        </div>

        {/* Divider */}
        <div
          style={{
            width: '80px',
            height: '3px',
            background: 'linear-gradient(90deg, #c0392b, #e67e22)',
            borderRadius: '2px',
            marginBottom: '24px',
            display: 'flex',
          }}
        />

        {/* Description */}
        <div
          style={{
            fontSize: '20px',
            color: '#aaaaaa',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: '1.5',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          Platform event jejepangan, cosplay, idol, toys & market Indonesia
        </div>

        {/* Category tags */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '12px',
            marginTop: '28px',
          }}
        >
          {['🎭 Cosplay', '🎤 Idol', '🧸 Toys', '🛒 Market', '🎮 Game'].map(
            (tag) => (
              <div
                key={tag}
                style={{
                  background: 'rgba(200,100,0,0.18)',
                  border: '1px solid rgba(200,120,0,0.35)',
                  color: '#f0c060',
                  borderRadius: '20px',
                  padding: '6px 16px',
                  fontSize: '15px',
                  fontWeight: '600',
                  display: 'flex',
                }}
              >
                {tag}
              </div>
            )
          )}
        </div>

        {/* URL badge */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            right: '32px',
            color: '#666666',
            fontSize: '14px',
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
