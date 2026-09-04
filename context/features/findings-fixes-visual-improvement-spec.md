# Findings fixes visual improvements

## General

* make a new color var --type-main-support value #99d7f
* give all h1 color  var(--type-main)
* make font-size h2 1.5 rem
* create new page /items you can reuse /favorites but with header Items
* create new page /favorite-collections you can reuse /collections but with header Favorite collections

## Dashboard

* Link Items stat-card to /items
* Link collections stat-card to /collections
* Link favorite collections stat-card to /favorite-collections



## Sidebar

* create a link View all types, visibele when Types drawer is closed as we did with View all collections.  Destination /items
* make dashboard icon color  var(--type-main-support)
* make favorites icon yellow var(--type-favorite)

## 

## Settings page

* the dot from settings-switch is not vertically centered but to high
* If a user is not pro user disable the AI features section and provide a link to the pro features popup
* Between Plan and Editor create a section called appearance with a dark-mode theme switch. For now it toggles the className="dark" in layout.tsx:42
* Exclude the marketing page from dark/light mode but mention it as switchable at the prizing section



## 

## Profile page

* make Items by Type H2
* link the stat-cards to their representative pages

