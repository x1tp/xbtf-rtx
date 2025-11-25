import { Vector3 } from 'three';

export const AtmosphereShader = {
  uniforms: {
    v3LightPosition: { value: new Vector3(1e8, 0, 1e8) },
    v3CameraPos: { value: new Vector3() },
    v3InvWavelength: { value: new Vector3(1 / Math.pow(0.650, 4), 1 / Math.pow(0.570, 4), 1 / Math.pow(0.475, 4)) },
    fCameraHeight: { value: 0 },
    fCameraHeight2: { value: 0 },
    fInnerRadius: { value: 0 },
    fInnerRadius2: { value: 0 },
    fOuterRadius: { value: 0 },
    fOuterRadius2: { value: 0 },
    fKrESun: { value: 0.0025 * 20.0 },
    fKmESun: { value: 0.0010 * 20.0 },
    fKr4PI: { value: 0.0025 * 4.0 * Math.PI },
    fKm4PI: { value: 0.0010 * 4.0 * Math.PI },
    fScale: { value: 1 / (10.25 - 10.0) },
    fScaleDepth: { value: 0.25 },
    fScaleOverScaleDepth: { value: 0 },
    g: { value: -0.95 },
    g2: { value: 0.95 * 0.95 },
  },

  vertexShader: `
    uniform vec3 v3LightPosition;
    uniform vec3 v3CameraPos;
    uniform float fCameraHeight;
    uniform float fCameraHeight2;
    uniform float fOuterRadius;
    uniform float fOuterRadius2;
    uniform float fInnerRadius;
    uniform float fScale;
    uniform float fScaleDepth;
    uniform float fScaleOverScaleDepth;
    uniform float fKrESun;
    uniform float fKmESun;
    uniform float fKr4PI;
    uniform float fKm4PI;
    uniform vec3 v3InvWavelength;

    varying vec3 v3Direction;
    varying vec3 c0;
    varying vec3 c1;
    varying float vSunDot;

    float scale(float fCos) {
      float x = 1.0 - fCos;
      return fScaleDepth * exp(-0.00287 + x * (0.459 + x * (3.83 + x * (-6.80 + x * 5.25))));
    }

    void main(void) {
      // Get the ray from the camera to the vertex (Entry Point)
      // We assume position is in local space (relative to planet center)
      vec3 v3Pos = position;
      vec3 v3Ray = v3Pos - v3CameraPos;
      float fDistToVertex = length(v3Ray);
      v3Ray /= fDistToVertex;

      // Calculate intersection with Outer Sphere (Exit point)
      // Ray: P = Camera + t * RayDir
      // Sphere: |P|^2 = R_outer^2
      // |Camera + t*Ray|^2 = R^2
      // |C|^2 + 2t(C.R) + t^2 - R^2 = 0
      // t^2 + 2(C.R)t + (|C|^2 - R^2) = 0
      
      float B = 2.0 * dot(v3CameraPos, v3Ray);
      float C = fCameraHeight2 - fOuterRadius2;
      float fDet = max(0.0, B*B - 4.0 * C);
      
      // Near and Far intersections with outer sphere
      float fNear = 0.5 * (-B - sqrt(fDet));
      float fFar = 0.5 * (-B + sqrt(fDet));

      // If we are outside the atmosphere, the ray starts at the near intersection
      // If we are inside, it starts at the camera (0.0)
      bool bCameraInside = fCameraHeight < fOuterRadius;
      float fStart = bCameraInside ? 0.0 : fNear;
      float fEnd = fFar;

      // If the ray hits the planet (Inner Sphere), stop there
      // Intersection with Inner Sphere
      float C_inner = fCameraHeight2 - (fInnerRadius * fInnerRadius);
      float fDetInner = B*B - 4.0 * C_inner;
      
      if (fDetInner > 0.0) {
          float fNearInner = 0.5 * (-B - sqrt(fDetInner));
          // If the planet intersection is valid (positive) and closer than the exit point
          if (fNearInner > 0.0 && fNearInner < fEnd) {
              fEnd = fNearInner;
          }
      }

      vec3 v3StartPos = v3CameraPos + v3Ray * fStart;
      float fRayLength = fEnd - fStart;

      // Initialize the scattering loop variables
      float fSampleLength = fRayLength / 5.0; // 5 samples
      float fScaledLength = fSampleLength * fScale;
      vec3 v3SampleRay = v3Ray * fSampleLength;
      vec3 v3SamplePoint = v3StartPos + v3SampleRay * 0.5;

      // Loop through the sample rays
      vec3 v3FrontColor = vec3(0.0, 0.0, 0.0);
      for(int i=0; i<5; i++) {
        float fHeight = length(v3SamplePoint);
        float fDepth = exp(fScaleOverScaleDepth * (fInnerRadius - fHeight));
        
        float fLightAngle = dot(v3LightPosition, v3SamplePoint) / fHeight;
        float fCameraAngle = dot(v3Ray, v3SamplePoint) / fHeight;
        
        // Calculate scattering factor
        // For space view: Light -> Point -> Camera
        // Optical Depth = Depth(Sun->Point) + Depth(Point->Camera)
        // Depth(Sun->Point) = scale(fLightAngle) * fDepth
        // Depth(Point->Camera) = scale(-fCameraAngle) * fDepth
        // Note: fCameraAngle is cos(Ray, Point). Ray is Camera->Point. 
        // We want cos(View, Point) where View is Point->Camera. So -fCameraAngle.
        
        float fScatter = fDepth * (scale(fLightAngle) + scale(-fCameraAngle));
        vec3 v3Attenuate = exp(-fScatter * (v3InvWavelength * fKr4PI + fKm4PI));
        
        v3FrontColor += v3Attenuate * (fDepth * fScaledLength);
        v3SamplePoint += v3SampleRay;
      }

      vSunDot = clamp(dot(normalize(position), normalize(v3LightPosition)), 0.0, 1.0);
      c0 = v3FrontColor * (v3InvWavelength * fKrESun);
      c1 = v3FrontColor * fKmESun;
      v3Direction = v3CameraPos - v3Pos;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform vec3 v3LightPosition;
    uniform float g;
    uniform float g2;

    varying vec3 v3Direction;
    varying vec3 c0;
    varying vec3 c1;
    varying float vSunDot;

    // Mie phase function
    float getMiePhase(float fCos, float fCos2, float g, float g2) {
      return 1.5 * ((1.0 - g2) / (2.0 + g2)) * (1.0 + fCos2) / pow(1.0 + g2 - 2.0 * g * fCos, 1.5);
    }

    // Rayleigh phase function
    float getRayleighPhase(float fCos2) {
      return 0.75 * (1.0 + fCos2);
    }

    void main(void) {
      float fCos = dot(v3LightPosition, v3Direction) / length(v3Direction);
      float fCos2 = fCos * fCos;
      
      vec3 color = getRayleighPhase(fCos2) * c0 + getMiePhase(fCos, fCos2, g, g2) * c1;
      
      // Fade the atmosphere hard on the night side; keep only a hairline rim near the terminator
      float sunLit = smoothstep(0.0, 0.15, vSunDot);
      color *= mix(0.01, 1.0, sunLit);
      
      // Tone mapping
      color = vec3(1.0) - exp(-color);

      gl_FragColor = vec4(color, 1.0);
    }
  `
};
