import type { FC } from 'react';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

export const SimpleEffects: FC = () => {
    return (
        <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom intensity={1.5} luminanceThreshold={0.9} luminanceSmoothing={0.025} mipmapBlur />
            <ToneMapping
                mode={ToneMappingMode.ACES_FILMIC}
                exposure={1.15}
                adaptive={false}
            />
        </EffectComposer>
    );
};
