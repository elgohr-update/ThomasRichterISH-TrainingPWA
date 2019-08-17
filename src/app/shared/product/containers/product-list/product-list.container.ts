import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { concatMap, map, take, takeUntil } from 'rxjs/operators';

import { Category } from 'ish-core/models/category/category.model';
import { ProductListingID, ProductListingView } from 'ish-core/models/product-listing/product-listing.model';
import { ViewType } from 'ish-core/models/viewtype/viewtype.types';
import {
  LoadMoreProducts,
  getProductListingLoading,
  getProductListingView,
  getProductListingViewType,
} from 'ish-core/store/shopping/product-listing';
import { whenFalsy, whenTruthy } from 'ish-core/utils/operators';

@Component({
  selector: 'ish-product-list-container',
  templateUrl: './product-list.container.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductListContainerComponent implements OnInit, OnChanges, OnDestroy {
  @Input() category?: Category;
  @Input() id: ProductListingID;
  @Input() mode: 'endless-scrolling' | 'paging' = 'endless-scrolling';
  @Input() fragmentOnRouting = 'product-list-top';

  productListingView$: Observable<ProductListingView>;
  viewType$ = this.store.pipe(select(getProductListingViewType));
  listingLoading$ = this.store.pipe(select(getProductListingLoading));
  currentPage$ = this.activatedRoute.queryParamMap.pipe(map(params => +params.get('page') || 1));
  sortBy$ = this.activatedRoute.queryParamMap.pipe(map(params => params.get('sorting')));

  private destroy$ = new Subject();

  constructor(private store: Store<{}>, private router: Router, private activatedRoute: ActivatedRoute) {}

  ngOnInit() {
    // append view queryParam to URL if none is set
    this.activatedRoute.queryParamMap
      .pipe(
        map(params => params.has('view')),
        take(1),
        whenFalsy(),
        concatMap(() =>
          this.viewType$.pipe(
            whenTruthy(),
            take(1)
          )
        )
      )
      .subscribe(view => this.changeViewType(view));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.id) {
      this.productListingView$ = this.store.pipe(
        select(getProductListingView, this.id),
        takeUntil(this.destroy$)
      );
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
  }

  /**
   * Emits the event for switching the view type of the product list.
   * @param view The new view type.
   */
  changeViewType(view: ViewType) {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      replaceUrl: true,
      queryParamsHandling: 'merge',
      queryParams: { view },
    });
  }

  /**
   * Emits the event for loading more products.
   */
  loadMoreProducts(direction: 'up' | 'down') {
    this.productListingView$
      .pipe(
        take(1),
        map(view => (direction === 'down' ? view.nextPage() : view.previousPage())),
        whenTruthy()
      )
      .subscribe(page => {
        this.store.dispatch(new LoadMoreProducts({ id: this.id, page }));
      });
  }

  get isEndlessScrolling() {
    return this.mode === 'endless-scrolling';
  }

  get isPaging() {
    return !this.isEndlessScrolling;
  }
}
