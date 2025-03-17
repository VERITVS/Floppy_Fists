import * as T from 'three';
import {hidden, shades, shapes, color, v3, m4, identity, translation, make_obj, set_pos, dist} from './defs.js'
import { iridescenceThickness } from 'three/tsl';


export class HermiteCurve {
    constructor(sample_count, color = 0xffffff, hidden = false) {
        this.sample_count = sample_count;
        this.points = [];
        this.tangents = [];

        let width = (hidden) ? 0 : 1;

        const material = new T.LineBasicMaterial( {
            color: 0x00ff00,
            linewidth: width,
            linecap: 'round', //ignored by WebGLRenderer
            linejoin:  'round' //ignored by WebGLRenderer
        } );
        this.material = material;
    }

    add_point(x, y, z, tx, ty, tz) {
        this.points.push(v3(x, y, z));
        this.tangents.push(v3(tx, ty, tz));
    }

    get_value(time) {
        let max_time = this.points.length - 1;
        if (max_time < 1) return null;

        // Wrap time within valid range
        while (time < 0) time += max_time;
        time = time % max_time;

        let floor_time = Math.floor(time);
        if (time === floor_time && floor_time !== 0) floor_time -= 1;

        if (floor_time + 1 > max_time) return null;

        let p0 = this.points[floor_time];
        let p1 = this.points[floor_time + 1];
        let m0 = this.tangents[floor_time];
        let m1 = this.tangents[floor_time + 1];

        let t = time - floor_time;
        let t2 = t * t;
        let t3 = t2 * t;

        let h00 = 2 * t3 - 3 * t2 + 1;
        let h10 = t3 - 2 * t2 + t;
        let h01 = -2 * t3 + 3 * t2;
        let h11 = t3 - t2;

        return v3(
            h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x,
            h00 * p0.y + h10 * m0.y + h01 * p1.y + h11 * m1.y,
            h00 * p0.z + h10 * m0.z + h01 * p1.z + h11 * m1.z
        );
    }

    get_pos(time, matrix = identity()) {
        let init_pos = matrix.clone();
        let obj_pos = this.get_value(time);
    
        let transformed_pos = new T.Vector3(obj_pos.x, obj_pos.y, obj_pos.z);
        transformed_pos.applyMatrix4(init_pos);    
        return transformed_pos;
    }

    generate_curve() {
        if (this.points.length < 2) return null;

        let curve_points = [];
        for (let i = 0; i < this.points.length - 1; i++) {
            for (let j = 0; j <= this.sample_count; j++) {
                let t = i + j / this.sample_count;
                curve_points.push(this.get_value(t));
            }
        }

        return new T.BufferGeometry().setFromPoints(curve_points);
    }

    create_line() {
        let geometry = this.generate_curve();
        console.log('GEOMETRY: ', geometry)
        return geometry ? new T.Line(geometry, this.material) : null;
    }

}
