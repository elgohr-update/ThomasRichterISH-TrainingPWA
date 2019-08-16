import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action, Store, StoreModule, combineReducers } from '@ngrx/store';
import { cold, hot } from 'jest-marbles';
import { Observable, of, throwError } from 'rxjs';
import { anyString, anything, instance, mock, verify, when } from 'ts-mockito';

import { categoryTree } from 'ish-core/utils/dev/test-data-utils';
import { Category } from '../../../models/category/category.model';
import { FilterNavigation } from '../../../models/filter-navigation/filter-navigation.model';
import { HttpError } from '../../../models/http-error/http-error.model';
import { FilterService } from '../../../services/filter/filter.service';
import { LoadCategorySuccess, SelectCategory, SelectedCategoryAvailable } from '../categories';
import { LoadProduct } from '../products';
import { SearchProductsSuccess } from '../search';
import { shoppingReducers } from '../shopping-store.module';
import { SetPagingInfo } from '../viewconf';

import * as fromActions from './filter.actions';
import { FilterEffects } from './filter.effects';

describe('Filter Effects', () => {
  let actions$: Observable<Action>;
  let effects: FilterEffects;
  let store$: Store<{}>;
  let filterServiceMock: FilterService;

  const filterNav = {
    filter: [{ name: 'blubb', displayType: 'text_clear', facets: [{ name: 'a' }, { name: 'b' }] }],
  } as FilterNavigation;
  beforeEach(() => {
    filterServiceMock = mock(FilterService);
    when(filterServiceMock.getFilterForSearch(anything())).thenCall(a => {
      if (a === 'invalid') {
        return throwError({ message: 'invalid' });
      } else {
        return of(filterNav);
      }
    });
    when(filterServiceMock.getFilterForCategory(anything())).thenCall(a => {
      if (a.name === 'invalid') {
        return throwError({ message: 'invalid' });
      } else {
        return of(filterNav);
      }
    });

    when(filterServiceMock.getProductSkusForFilter(anything(), anything())).thenCall(a => {
      if (a.name === 'invalid') {
        return throwError({ message: 'invalid' });
      } else {
        return of(['123', '234']);
      }
    });

    when(filterServiceMock.applyFilter(anyString(), anyString())).thenCall(a => {
      if (a === 'invalid') {
        return throwError({ message: 'invalid' });
      } else {
        return of(filterNav);
      }
    });
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        StoreModule.forRoot({
          shopping: combineReducers(shoppingReducers),
        }),
      ],
      providers: [
        FilterEffects,
        provideMockActions(() => actions$),
        { provide: FilterService, useFactory: () => instance(filterServiceMock) },
      ],
    });

    effects = TestBed.get(FilterEffects);
    store$ = TestBed.get(Store);
  });

  describe('loadAvailableFilterForCategories$', () => {
    it('should call the filterService for LoadFilterForCategories action', done => {
      const action = new fromActions.LoadFilterForCategory({ category: { name: 'c' } as Category });
      actions$ = of(action);

      effects.loadAvailableFilterForCategories$.subscribe(() => {
        verify(filterServiceMock.getFilterForCategory(anything())).once();
        done();
      });
    });

    it('should map to action of type LoadFilterForCategoriesSuccess', () => {
      const action = new fromActions.LoadFilterForCategory({ category: { name: 'c' } as Category });
      const completion = new fromActions.LoadFilterForCategorySuccess({ filterNavigation: filterNav });
      actions$ = hot('-a-a-a', { a: action });
      const expected$ = cold('-c-c-c', { c: completion });

      expect(effects.loadAvailableFilterForCategories$).toBeObservable(expected$);
    });

    it('should map invalid request to action of type LoadFilterForCategoriesFail', () => {
      const action = new fromActions.LoadFilterForCategory({ category: { name: 'invalid' } as Category });
      const completion = new fromActions.LoadFilterForCategoryFail({ error: { message: 'invalid' } as HttpError });
      actions$ = hot('-a-a-a', { a: action });
      const expected$ = cold('-c-c-c', { c: completion });

      expect(effects.loadAvailableFilterForCategories$).toBeObservable(expected$);
    });
  });

  describe('loadFilterIfCategoryWasSelected$', () => {
    it('should trigger LoadFilterForCategory for SelectCategory action', done => {
      const tree = categoryTree([
        {
          uniqueId: 'Cameras.Camcorder',
          categoryPath: ['Cameras', 'Cameras.Camcorder'],
        } as Category,
        {
          uniqueId: 'Cameras',
          categoryPath: ['Cameras'],
        } as Category,
      ]);

      store$.dispatch(new LoadCategorySuccess({ categories: tree }));
      store$.dispatch(new SelectCategory({ categoryId: 'Cameras.Camcorder' }));

      actions$ = of(new SelectedCategoryAvailable({ categoryId: 'Cameras.Camcorder' }));

      effects.loadFilterIfCategoryWasSelected$.subscribe(action => {
        expect(action).toMatchInlineSnapshot(`
          [Shopping] Load Filter For Category:
            category: {"uniqueId":"Cameras.Camcorder","categoryPath":[2]}
        `);
        done();
      });
    });
  });

  describe('applyFilter$', () => {
    it('should call the filterService for ApplyFilter action', done => {
      const action = new fromActions.ApplyFilter({ filterId: 'a', searchParameter: 'b' });
      actions$ = of(action);

      effects.applyFilter$.subscribe(() => {
        verify(filterServiceMock.applyFilter('a', 'b')).once();
        done();
      });
    });

    it('should map to action of type ApplyFilterSuccess', () => {
      const action = new fromActions.ApplyFilter({ filterId: 'a', searchParameter: 'b' });
      const completion = new fromActions.ApplyFilterSuccess({
        availableFilter: filterNav,
        filterName: 'a',
        searchParameter: 'b',
      });
      actions$ = hot('-a-a-a', { a: action });
      const expected$ = cold('-c-c-c', { c: completion });

      expect(effects.applyFilter$).toBeObservable(expected$);
    });

    it('should map invalid request to action of type ApplyFilterFail', () => {
      const action = new fromActions.ApplyFilter({ filterId: 'invalid', searchParameter: 'b' });
      const completion = new fromActions.ApplyFilterFail({ error: { message: 'invalid' } as HttpError });
      actions$ = hot('-a-a-a', { a: action });
      const expected$ = cold('-c-c-c', { c: completion });

      expect(effects.applyFilter$).toBeObservable(expected$);
    });
  });

  describe('loadFilteredProducts$', () => {
    it('should trigger SetFilteredProducts and LoadProduct for ApplyFilterSuccess action', () => {
      const action = new fromActions.ApplyFilterSuccess({
        availableFilter: filterNav,
        filterName: 'a',
        searchParameter: 'b',
      });
      store$.dispatch(action);
      const completion = new SetPagingInfo({ currentPage: 0, totalItems: 2, newProducts: ['123', '234'] });
      const loadProducts1 = new LoadProduct({ sku: '123' });
      const loadProducts2 = new LoadProduct({ sku: '234' });
      actions$ = hot('-a-----|', { a: action });
      const expected$ = cold('-(bcd)-|', { b: loadProducts1, c: loadProducts2, d: completion });
      expect(effects.loadFilteredProducts$).toBeObservable(expected$);
    });
  });

  describe('loadFilterForSearch$', () => {
    it('should call the filterService for LoadFilterForSearch action', done => {
      const action = new fromActions.LoadFilterForSearch({ searchTerm: 'search' });
      actions$ = of(action);

      effects.loadFilterForSearch$.subscribe(() => {
        verify(filterServiceMock.getFilterForSearch(anything())).once();
        done();
      });
    });

    it('should map to action of type LoadFilterForSearchSuccess', () => {
      const action = new fromActions.LoadFilterForSearch({ searchTerm: 'search' });
      const completion = new fromActions.LoadFilterForSearchSuccess({ filterNavigation: filterNav });
      actions$ = hot('-a-a-a', { a: action });
      const expected$ = cold('-c-c-c', { c: completion });

      expect(effects.loadFilterForSearch$).toBeObservable(expected$);
    });

    it('should map invalid request to action of type LoadFilterForSearchFail', () => {
      const action = new fromActions.LoadFilterForSearch({ searchTerm: 'invalid' });
      const completion = new fromActions.LoadFilterForSearchFail({ error: { message: 'invalid' } as HttpError });
      actions$ = hot('-a-a-a', { a: action });
      const expected$ = cold('-c-c-c', { c: completion });

      expect(effects.loadFilterForSearch$).toBeObservable(expected$);
    });
  });

  describe('loadFilterForSearchIfSearchSuccess$', () => {
    it('should trigger LoadFilterForSearch for SearchProductsSuccess action', () => {
      const action = new SearchProductsSuccess({ searchTerm: 'a' });

      const completion = new fromActions.LoadFilterForSearch({ searchTerm: 'a' });
      actions$ = hot('a', { a: action });
      const expected$ = cold('c', { c: completion });
      expect(effects.loadFilterForSearchIfSearchSuccess$).toBeObservable(expected$);
    });
  });
});
