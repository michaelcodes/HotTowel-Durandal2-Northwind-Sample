using Breeze.WebApi;
using HotTowelNorthwind.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;

namespace HotTowelNorthwind.Controllers
{
    [BreezeController]
    public class BreezeController : ApiController
    {
        readonly EFContextProvider<NorthwindContext> _contextProvider =
            new EFContextProvider<NorthwindContext>();

        [System.Web.Http.HttpGet]
        public string Metadata()
        {
            return _contextProvider.Metadata();
        }

        [System.Web.Http.HttpPost]
        public SaveResult SaveChanges(JObject saveBundle)
        {
            SaveResult saveResult = _contextProvider.SaveChanges(saveBundle);
            return saveResult;
        }

        [System.Web.Http.HttpGet]
        public IQueryable<Product> Products()
        {
            return _contextProvider.Context.Products;
        }

        [System.Web.Http.HttpGet]
        public IQueryable<Customer> Customers()
        {
            return _contextProvider.Context.Customers;
        }

        [System.Web.Http.HttpGet]
        public IQueryable<Order> Orders()
        {
            return _contextProvider.Context.Orders;
        }

    }
}
