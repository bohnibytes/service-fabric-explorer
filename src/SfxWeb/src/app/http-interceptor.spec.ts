import { TestBed } from '@angular/core/testing';
import { HttpTestingController, HttpClientTestingModule } from '@angular/common/http/testing';
import { httpInterceptorProviders } from './http-interceptor';
import { HttpClient } from '@angular/common/http';
import { DataService } from './services/data.service';
import { environment } from 'src/environments/environment';

describe('Http interceptors', () => {
    let httpClient: HttpClient;
    let httpMock: HttpTestingController;
    let dataService: Partial<DataService> = { readOnlyHeader: null, clusterNameMetadata: "old-name" };
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [httpInterceptorProviders, {provide: DataService, useValue: dataService}]
        });

        httpMock = TestBed.get(HttpTestingController);
        httpClient = TestBed.get(HttpClient);
    });


    fit('readonly enabled', async () => {
        httpClient.get('/test').subscribe();

        const request = httpMock.expectOne('/test');

        const headers = {"SFX-Readonly" : '1',
                         "SFX-ClusterName": 'test-cluster'};
        request.flush(null, { headers })

        expect(dataService.readOnlyHeader).toBeTruthy();
        expect(dataService.clusterNameMetadata).toBe("test-cluster");
    })

    fit('readonly off', async () => {
        httpClient.get('/test').subscribe();

        const request = httpMock.expectOne('/test');

        const headers = {"SFX-Readonly" : '0'};
        request.flush(null, { headers })

        expect(dataService.readOnlyHeader).toBeFalsy();
    })

    fit('sent headers', async () => {
        httpClient.get('/test').subscribe();

        const requests = httpMock.match({ method: 'get'});
        expect(requests[0].request.headers.get('x-servicefabricclienttype')).toBe('SFX');
        expect(requests[0].request.headers.get('sfx-build')).toBe(environment.version);
    })

});