import React from 'react';
import { Composition } from 'remotion';

import { LONG_CONTEXT_FRAMES,LongContextExplainer } from './LongContextExplainer';
import { Main, TOTAL_FRAMES } from './Main';
import { TOTAL_FRAMES as MD3_FRAMES } from './md3/tokens';
import { ZephyrusMD3 } from './md3/ZephyrusMD3';

export const Root: React.FC = () => (
  <>
    <Composition
      id="ZephyrusHorizontal"
      component={Main}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
    <Composition
      id="LongContextExplainer"
      component={LongContextExplainer}
      durationInFrames={LONG_CONTEXT_FRAMES}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
    <Composition
      id="ZephyrusMD3"
      component={ZephyrusMD3}
      durationInFrames={MD3_FRAMES}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{}}
    />
  </>
);
