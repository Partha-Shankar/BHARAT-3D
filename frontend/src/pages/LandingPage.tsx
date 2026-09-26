import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicHeader } from '../components/layout/PublicHeader';

const identities = [
  { level: 'Parent parcel', id: '48291503726481', height: 'ground' },
  { level: 'Flat 804', id: '48291503726481-F08-U804', height: '+24 m to +27 m' },
  { level: 'Basement', id: '48291503726481-B02', height: '−7 m to −1 m' },
  { level: 'Metro segment', id: '48291503726481-M01', height: '−14 m to −10 m' },
];

const steps = [
  'Keep the existing 14-digit ULPIN as the parent parcel.',
  'Give every owned volume a child identity: parent, level, and unit.',
  'Store the height range of that volume in metres.',
  'A surveyor confirms the volume before the identity is saved.',
];

const platformFeatures = [
  {
    title: 'Unauthorized extra floors and height',
    text:
      'The compliance engine compares sanctioned building permission to measured 3D height and floor count. A commercial block approved as ground plus four at 14.5 m but standing as ground plus six at 22.8 m is flagged with the excess volume ready for municipal enforcement.',
  },
  {
    title: 'Footpath and setback encroachment',
    text:
      'Structures that cross into public footpath or mandatory side setbacks are detected against the registered parcel and road network. The system records measurable overlap—such as about 3.5 m along the sidewalk—alongside setback breaches so inspectors see exactly what crossed the line.',
  },
  {
    title: 'Excavation clash and dig-safe planning',
    text:
      'Utility operators draw a proposed trench and depth on the parcel map before breaking ground. Registered metro tunnels, basements, gas, power, and water assets are checked in 3D with safety buffers, surfacing high-risk clashes before a digging clearance is issued.',
  },
  {
    title: 'One ground ULPIN, child volumes where it matters',
    text:
      "India's 14-digit ULPIN remains the parent identity on the surface. Flats, basement parking, air-rights bands, and metro segments receive child identities with metre height ranges only where ownership or infrastructure has real vertical extent.",
  },
  {
    title: 'Surveyor confirmation before the record is saved',
    text:
      'Survey fusion proposes candidate floors and units, but nothing enters the registry until a surveyor reviews the volume in the studio. Digital sign-off locks the child identity and height range only after that human verification step.',
  },
];

const workspaces = [
  {
    title: 'Surveyor',
    text: 'Draw or import the parcel, model floors and units in 3D, and register a child identity only after you confirm each volume.',
  },
  {
    title: 'Municipality',
    text: 'Check sanctioned height, setbacks, and footpath lines against what is registered in the 3D record.',
  },
  {
    title: 'Utility operator',
    text: 'Plan excavation against basement parking, pipes, and metro segments registered under the same ground parcel.',
  },
  {
    title: 'Citizen',
    text: 'See the flat or unit tied to you: its child identity, height range, and link to the 14-digit ground parcel.',
  },
];

const PARCEL_ULPIN = '48291503726481';
const DEPTH_MAX_M = 27;
const DEPTH_MIN_M = -14;
const DEPTH_SPAN_M = DEPTH_MAX_M - DEPTH_MIN_M;

/** Position from top of diagram (0% = +27 m, 100% = −14 m). */
const depthTopPercent = (metres: number) => ((DEPTH_MAX_M - metres) / DEPTH_SPAN_M) * 100;
const depthHeightPercent = (metres: number) => (metres / DEPTH_SPAN_M) * 100;

const ParcelHeightSection: React.FC = () => {
  const groundTop = depthTopPercent(0);
  const footprint =
    'absolute left-1/2 -translate-x-1/2 w-[42%] min-w-[4.75rem] max-w-[8.5rem] border-x border-[#1e4d6b]/30';

  return (
    <div className="select-none">
      <div className="flex items-stretch gap-2 sm:gap-3">
        <div
          className="hidden sm:flex shrink-0 w-9 flex-col justify-between py-1 text-[11px] font-medium text-[#5c6e7c] tabular-nums"
          aria-hidden
        >
          <span>+27 m</span>
          <span className="text-[#1e4d6b]">0</span>
          <span>−14 m</span>
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="relative w-full rounded-sm border border-[#e4dccf] bg-[#f3efe6] overflow-hidden"
            style={{ height: 'min(24rem, 62vw)' }}
          >
            <div
              className="absolute inset-x-0 top-0 bg-[#eef4f6]/70 pointer-events-none"
              style={{ height: `${groundTop}%` }}
            />
            <div
              className="absolute inset-x-0 bottom-0 bg-[#e8e0d4]/50 pointer-events-none"
              style={{ top: `${groundTop}%` }}
            />

            <span
              className="absolute left-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-[#5c6e7c] z-[1]"
              style={{ top: '0.35rem' }}
            >
              Above
            </span>
            <span
              className="absolute left-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-[#5c6e7c] z-[1]"
              style={{ top: `calc(${groundTop}% + 0.35rem)` }}
            >
              Below
            </span>

            <div
              className={`${footprint} top-0 bottom-0 border border-dashed border-[#1e4d6b]/15 bg-transparent z-0 pointer-events-none`}
              aria-hidden
            />

            <div
              className={`${footprint} z-[2] bg-[#1f7a72]/20`}
              style={{
                top: `${depthTopPercent(27)}%`,
                height: `${depthHeightPercent(27)}%`,
              }}
            >
              <div className="absolute inset-x-0 bottom-0 top-[11.11%] bg-[#1f7a72]/30" aria-hidden />
              <div
                className="absolute inset-x-0 top-0 bg-[#1f7a72] text-white px-1 py-0.5 sm:py-1 overflow-hidden"
                style={{ height: '11.11%' }}
              >
                <div className="text-[9px] sm:text-[10px] font-semibold leading-tight">Flat 804</div>
                <div className="text-[8px] sm:text-[9px] opacity-90 leading-tight">+24 m to +27 m</div>
              </div>
              <div
                className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-0.5 text-[8px] sm:text-[9px] leading-tight text-[#16324a]/75 text-center px-0.5"
                style={{ top: '11.11%', bottom: '0.35rem' }}
              >
                Building volume (same footprint)
              </div>
              <div
                className="absolute inset-x-0 bottom-0 h-1 sm:h-1.5 bg-[#c9bfb0] border-y border-[#a89884] z-[1]"
                title="Floor plate at ground"
              />
            </div>

            <div
              className={`${footprint} z-[2] rounded-b-sm bg-[#c4a574]/95 text-[#16324a] px-1 py-0.5 flex flex-col justify-center overflow-hidden`}
              style={{
                top: `${depthTopPercent(-1)}%`,
                height: `${depthHeightPercent(6)}%`,
              }}
            >
              <div className="text-[9px] sm:text-[10px] font-semibold leading-tight">Basement parking</div>
              <div className="text-[8px] sm:text-[9px] leading-tight">−7 m to −1 m</div>
            </div>

            <div
              className={`${footprint} z-[2] bg-[#3d5a73] text-white px-1 py-0.5 flex flex-col justify-center overflow-hidden`}
              style={{
                top: `${depthTopPercent(-10)}%`,
                height: `${depthHeightPercent(4)}%`,
              }}
            >
              <div className="text-[9px] sm:text-[10px] font-semibold leading-tight">Metro segment</div>
              <div className="text-[8px] sm:text-[9px] opacity-90 leading-tight">−14 m to −10 m</div>
            </div>

            <div
              className="absolute z-[3] left-[4%] right-[2%] sm:left-[5%] sm:right-[3%] rounded-sm border-2 border-dashed border-[#1f7a72] bg-[#3d9b90]/30 px-1.5 py-0.5 flex flex-col justify-center min-w-0"
              style={{
                top: `${depthTopPercent(11)}%`,
                height: `${depthHeightPercent(3)}%`,
              }}
            >
              <div className="text-[9px] sm:text-[10px] font-semibold text-[#16324a] leading-tight">
                Air-rights corridor (sky / air)
              </div>
              <div className="text-[8px] sm:text-[9px] text-[#3d5363] leading-tight">+8 m to +11 m</div>
            </div>

            <div
              className="absolute inset-x-0 z-[4] flex items-center -translate-y-1/2"
              style={{ top: `${groundTop}%` }}
            >
              <div className="h-[3px] flex-1 bg-[#1e4d6b]" />
              <div className="shrink-0 px-1.5 sm:px-2 py-0.5 bg-[#1e4d6b] text-white text-center max-w-[11rem] sm:max-w-none">
                <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wide">Ground</div>
                <div className="sm:hidden text-[8px] font-medium leading-tight mt-0.5 normal-case">
                  Parent parcel · {PARCEL_ULPIN}
                </div>
              </div>
              <div className="h-[3px] flex-1 bg-[#1e4d6b]" />
            </div>

            <div
              className="absolute z-[4] max-sm:hidden sm:block sm:left-[56%] sm:right-2 sm:max-w-[11rem] -translate-y-1/2"
              style={{ top: `${groundTop}%` }}
            >
              <div className="bg-white border border-[#e4dccf] px-1.5 py-1 rounded-sm">
                <div className="text-[9px] sm:text-[10px] font-semibold text-[#16324a] leading-tight">Parent parcel</div>
                <div className="text-[8px] sm:text-[9px] text-[#1e4d6b] font-medium leading-tight break-all">
                  {PARCEL_ULPIN}
                </div>
                <div className="text-[8px] text-[#5c6e7c] leading-tight">14-digit ULPIN</div>
              </div>
            </div>
          </div>

          <p className="text-[10px] sm:text-[11px] leading-snug text-[#3d5363] mt-2">
            The air-rights band is registered separately at +8 m to +11 m — through the lower tower, not the flat at +24 m to +27 m.
          </p>
        </div>
      </div>
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="public-shell min-h-screen flex flex-col">
      <PublicHeader showSectionNav />

      <main>
        <section id="solution" className="max-w-6xl mx-auto px-5 py-16 lg:py-20 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-[#1f7a72] font-semibold text-[15px] mb-3">
              BHARAT 3D
            </p>
            <h1 className="text-[2.4rem] sm:text-5xl leading-[1.15] text-[#16324a]">
              A 3D land registry for Indian cities
            </h1>
            <p className="mt-4 text-xl sm:text-2xl leading-snug text-[#1e4d6b] font-serif font-semibold">
              One ground number is not enough
            </p>
            <p className="mt-5 text-[17px] leading-7 text-[#3d5363] max-w-xl">
              India&apos;s 14-digit ULPIN stays the identity of the ground parcel. BHARAT 3D adds a child 3D identity only where something has height or depth—a flat, an air-rights corridor, basement parking, or a metro segment—with the height range stored in metres. A surveyor confirms each volume before it is saved to the registry.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="bg-[#1e4d6b] hover:bg-[#173e56] text-white text-[15px] font-semibold px-5 py-2.5 rounded-sm"
              >
                Open a workspace
              </button>
              <a href="#extension" className="text-[15px] font-semibold text-[#1f7a72] hover:text-[#18655e]">
                See the identity extension
              </a>
            </div>
          </div>

          <figure className="bg-white border border-[#e4dccf] rounded-sm p-5 sm:p-6">
            <figcaption className="text-sm text-[#5c6e7c] mb-4">
              The same parcel, read by height
            </figcaption>
            <ParcelHeightSection />
          </figure>
        </section>

        <section id="extension" className="bg-white border-y border-[#e4dccf]">
          <div className="max-w-6xl mx-auto px-5 py-16">
            <h2 className="text-3xl text-[#16324a]">How the 3D extension works</h2>
            <p className="mt-3 max-w-2xl text-[17px] leading-7 text-[#3d5363]">
              The national ULPIN on the ground is unchanged. Child identities are issued only for owned volumes above or below that parcel.
            </p>

            <ol className="mt-8 grid sm:grid-cols-2 gap-x-10 gap-y-5">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-4">
                  <span className="mt-0.5 w-7 h-7 shrink-0 rounded-full bg-[#1f7a72] text-white text-sm font-semibold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="text-[16px] leading-6 text-[#243b4d]">{step}</span>
                </li>
              ))}
            </ol>

            <div className="mt-10 overflow-x-auto border border-[#e4dccf] rounded-sm">
              <table className="w-full text-left text-[15px]">
                <thead className="bg-[#1e4d6b] text-white">
                  <tr>
                    <th className="font-semibold px-4 py-3">Level</th>
                    <th className="font-semibold px-4 py-3">3D identity</th>
                    <th className="font-semibold px-4 py-3">Height</th>
                  </tr>
                </thead>
                <tbody>
                  {identities.map((row, index) => (
                    <tr key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-[#f7f4ee]'}>
                      <td className="px-4 py-3 text-[#16324a]">{row.level}</td>
                      <td className="px-4 py-3 font-medium text-[#1e4d6b]">{row.id}</td>
                      <td className="px-4 py-3 text-[#3d5363]">{row.height}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 text-[16px] text-[#16324a]">
              Same national ULPIN. Extended only where the property has a vertical or underground extent.
            </p>
          </div>
        </section>

        <section id="capabilities" className="bg-[#f3efe6] border-y border-[#e4dccf]">
          <div className="max-w-6xl mx-auto px-5 py-16">
            <h2 className="text-3xl text-[#16324a]">What the registry checks in 3D</h2>
            <p className="mt-3 max-w-2xl text-[17px] leading-7 text-[#3d5363]">
              Beyond naming volumes, BHARAT 3D runs the spatial checks municipalities and utilities need on the same parcel record.
            </p>
            <ul className="mt-10 space-y-0 divide-y divide-[#e4dccf] border border-[#e4dccf] rounded-sm bg-white">
              {platformFeatures.map((feature) => (
                <li key={feature.title} className="px-5 py-6 sm:px-6 sm:py-7">
                  <h3 className="text-xl text-[#1e4d6b] font-serif">{feature.title}</h3>
                  <p className="mt-2 text-[15px] sm:text-[16px] leading-7 text-[#3d5363] max-w-3xl">{feature.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="workspaces" className="max-w-6xl mx-auto px-5 py-16">
          <h2 className="text-3xl text-[#16324a]">Four workspaces, one registry</h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-7 text-[#3d5363]">
            Surveyors, municipalities, utility operators, and citizens each sign in to the part of the record they are authorised to use.
          </p>
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {workspaces.map((item) => (
              <button
                key={item.title}
                onClick={() => navigate('/login')}
                className="text-left bg-white border border-[#e4dccf] hover:border-[#1f7a72] rounded-sm p-5"
              >
                <h3 className="text-xl text-[#1e4d6b]">{item.title}</h3>
                <p className="mt-2 text-[15px] leading-6 text-[#3d5363]">{item.text}</p>
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-auto bg-[#1e4d6b] text-[#d5e3ea]">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm">
          <div>
            <div className="text-[#f3efe6] font-semibold">BHARAT 3D</div>
            <div className="mt-1">SIH 2026 · PS 26011</div>
          </div>
          <div className="flex items-center gap-5">
            <button onClick={() => navigate('/privacy')} className="hover:text-white">Privacy</button>
            <button onClick={() => navigate('/terms')} className="hover:text-white">Terms</button>
            <button onClick={() => navigate('/login')} className="hover:text-white">Sign in</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
