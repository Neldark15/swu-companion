import * as THREE from 'three'

/** Halo volumétrico aproximado: desvanece la silueta, sin postprocesar la escena. */
export function crearHaloKyber(opacidad: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color('#39c9ff') },
      opacidad: { value: opacidad },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 normalVista;
      varying vec3 posicionVista;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        normalVista = normalize(normalMatrix * normal);
        posicionVista = p.xyz;
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacidad;
      varying vec3 normalVista;
      varying vec3 posicionVista;
      void main() {
        float frente = abs(dot(normalize(normalVista), normalize(-posicionVista)));
        float borde = pow(smoothstep(0.0, 1.0, frente), 2.2);
        gl_FragColor = vec4(color, borde * opacidad);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}
